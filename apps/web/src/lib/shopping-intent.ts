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
  budgetAmount: number | null;
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
  const budgetAmount = parseBudgetAmount(userText);
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
    budgetAmount,
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
  'specific-component': 3,
  'upgrade-path': 3,
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

// ── Shopping Answer (advisor-first structure) ─────────

export interface ProductExample {
  name: string;
  brand: string;
  price: number;
  fitNote: string;
  caution?: string;
  links?: { label: string; url: string }[];
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
}

// ── Taste direction templates ─────────────────────────

interface TasteProfile {
  check: (traits: Record<string, string>) => boolean;
  label: string;
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
    directionByCategory: {
      dac: 'A DAC direction that prioritizes transient definition, rhythmic precision, and dynamic contrast over warmth-first tuning.',
      amplifier: 'An amplifier direction that prioritizes current delivery, tight damping, and transient snap over tonal smoothness.',
      speakers: 'A speaker direction that prioritizes fast drivers, simple crossovers, and transient preservation over tonal warmth.',
      headphones: 'A headphone direction that prioritizes planar-magnetic speed and uniform diaphragm response over dynamic-driver warmth.',
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
    directionByCategory: {
      dac: 'A DAC direction that prioritizes tonal weight, harmonic texture, and musical flow over analytical precision.',
      amplifier: 'An amplifier direction that prioritizes harmonic density and musical continuity over measured specifications.',
      speakers: 'A speaker direction that prioritizes tonal weight and natural-material cone texture over speed.',
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
    directionByCategory: {
      dac: 'A DAC direction that prioritizes transparency, information retrieval, and measured resolution.',
      amplifier: 'An amplifier direction that prioritizes wide bandwidth, low distortion, and upstream transparency.',
      speakers: 'A speaker direction that prioritizes resolution, rigid cabinets, and monitor-style accuracy.',
      headphones: 'A headphone direction that prioritizes electrostatic or high-end planar resolution and spatial detail.',
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
    directionByCategory: {
      dac: 'A DAC direction that prioritizes smoothness, low fatigue, and listening ease over analytical resolution.',
      amplifier: 'An amplifier direction that prioritizes gentle high-frequency behavior and composure over transient edge.',
      speakers: 'A speaker direction that prioritizes soft-dome or ribbon tweeters and non-fatiguing extension.',
      headphones: 'A headphone direction that prioritizes warm tuning and rolled-off treble for long sessions.',
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
    directionByCategory: {
      dac: 'A DAC direction that prioritizes musical flow, composure, and organic texture over speed or analytical precision.',
      amplifier: 'An amplifier direction that prioritizes single-ended tube composure and texture over dynamic punch.',
      speakers: 'A speaker direction that prioritizes gentle crossover slopes and natural-material drivers.',
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
  speakers: 'speakers',
  headphones: 'headphones',
  streamer: 'streamer',
  general: 'component',
};

// ── Product integration ───────────────────────────────

import { DAC_PRODUCTS } from './products/dacs';
import type { Product } from './products/dacs';
import { rankProducts } from './product-scoring';

/**
 * Generate a one-sentence fit note for a product based on its
 * architecture and strongest matching traits.
 */
function buildFitNote(product: Product, userTraits: Record<string, SignalDirection>): string {
  const arch = product.architecture;
  const strongTraits: string[] = [];

  for (const [trait, direction] of Object.entries(userTraits)) {
    const val = product.traits[trait];
    if (val !== undefined && direction === 'up' && val >= 0.7) {
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
 * Generate an optional caution note from the product's notes field
 * and its risk trait values.
 */
function buildCaution(product: Product): string | undefined {
  if (product.notes) return product.notes;

  // Check for elevated risk traits
  if ((product.traits.glare_risk ?? 0) >= 0.4) {
    return 'May introduce glare or edge in systems that are already bright.';
  }
  if ((product.traits.fatigue_risk ?? 0) >= 0.4) {
    return 'May contribute to listening fatigue in long sessions.';
  }

  return undefined;
}

/**
 * Select up to 3 product examples for the given category, scored
 * against user traits and budget. Returns empty array if no
 * catalog exists for the category or budget is unknown.
 */
function selectProductExamples(
  category: ShoppingCategory,
  userTraits: Record<string, SignalDirection>,
  budgetAmount: number | null,
): ProductExample[] {
  // Only DACs have a catalog for now
  if (category !== 'dac') return [];
  if (budgetAmount === null) return [];

  const ranked = rankProducts(DAC_PRODUCTS, userTraits, budgetAmount);
  const top = ranked.slice(0, 3);

  return top.map(({ product }) => ({
    name: product.name,
    brand: product.brand,
    price: product.price,
    fitNote: buildFitNote(product, userTraits),
    caution: buildCaution(product),
    links: product.retailer_links.length > 0 ? product.retailer_links : undefined,
  }));
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
): ShoppingAnswer {
  const traits = signals.traits;
  const categoryLabel = CATEGORY_LABELS[ctx.category];

  // Find the best-matching taste profile
  const matchedProfile = TASTE_PROFILES.find((p) => p.check(traits));
  const taste = matchedProfile ?? FALLBACK_TASTE;

  // 1. Preference summary
  const preferenceSummary = `You appear to value ${taste.label} more than ${getContrastLabel(taste.label)}.`;

  // 2. Best-fit direction
  const bestFitDirection = matchedProfile?.directionByCategory[ctx.category]
    ?? taste.defaultDirection;

  // 3. Why this fits
  const whyThisFits = matchedProfile?.whyByCategory?.[ctx.category]
    ?? taste.defaultWhy ?? matchedProfile?.defaultWhy ?? FALLBACK_TASTE.defaultWhy;

  // 4. Product examples (only when catalog exists + budget known)
  const productExamples = selectProductExamples(ctx.category, traits, ctx.budgetAmount);

  // 5. Watch for
  const watchFor = taste.watchFor;

  // 6. System note
  const systemNote = ctx.systemProvided
    ? `This direction makes more sense if the rest of the chain is not already biased in the same way. A ${categoryLabel} change will shift the overall balance — listen for whether the qualities you value are preserved.`
    : undefined;

  return {
    category: categoryLabel,
    budget: ctx.budgetAmount,
    preferenceSummary,
    bestFitDirection,
    whyThisFits,
    productExamples,
    watchFor,
    systemNote,
  };
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
