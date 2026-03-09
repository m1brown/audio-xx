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

// ── Shopping Answer ───────────────────────────────────

export interface ShoppingAnswer {
  /** One-line summary of the inferred preference. */
  preferenceSummary: string;
  /** What architectural direction fits. */
  direction: string;
  /** 1–2 trade-offs to be aware of. */
  tradeoffs: string[];
  /** Optional system-coherence note. */
  systemNote: string | null;
}

// ── Taste direction templates ─────────────────────────

interface TasteProfile {
  /** Which trait directions are present (from ExtractedSignals.traits). */
  check: (traits: Record<string, string>) => boolean;
  label: string;
  directionByCategory: Partial<Record<ShoppingCategory, string>>;
  defaultDirection: string;
  tradeoffs: string[];
}

const TASTE_PROFILES: TasteProfile[] = [
  {
    check: (t) => t.dynamics === 'up' || t.elasticity === 'up',
    label: 'speed, transient precision, and rhythmic engagement',
    directionByCategory: {
      dac: 'Look for DACs that prioritize timing and leading-edge definition. R-2R ladder designs (Denafrips, Holo Audio) and certain AKM-based implementations tend to emphasize rhythmic coherence over smoothness.',
      amplifier: 'Amplifiers with high current delivery and tight damping tend to serve speed well. Class A/B designs with short signal paths often deliver better transient snap than heavily buffered topologies.',
      speakers: 'Speakers with lightweight, fast drivers and simple crossovers tend to preserve transient information. Single-driver or two-way designs often outperform complex multi-way systems for perceived speed.',
      headphones: 'Planar magnetic headphones typically excel at transient speed and attack. Their uniform diaphragm movement produces tighter leading edges than most dynamic drivers.',
      streamer: 'The streamer contributes to perceived timing through clock quality and jitter performance. Look for dedicated streamers with low-jitter clocks rather than multi-purpose devices.',
    },
    defaultDirection: 'Prioritize components known for timing precision and transient definition over tonal smoothness.',
    tradeoffs: [
      'Components that excel at speed often trade some tonal density and harmonic richness.',
      'Very fast systems can feel lean or relentless over long listening sessions.',
    ],
  },
  {
    check: (t) => t.tonal_density === 'up' && t.flow === 'up',
    label: 'harmonic richness, flow, and tonal density',
    directionByCategory: {
      dac: 'DACs that emphasize tonal weight and harmonic texture tend to use R-2R or tube output stages. Designs from Denafrips, Border Patrol, and MHDT prioritize body over analytical precision.',
      amplifier: 'Tube amplifiers and Class A solid-state designs tend to deliver greater harmonic density. Look for designs that prioritize musicality over measured specifications.',
      speakers: 'Speakers with heavier cones and more complex crossovers can deliver greater tonal weight, though at the cost of speed. Paper and treated fiber cones often sound richer than metal diaphragms.',
      headphones: 'Dynamic driver headphones with warm tunings tend to deliver more tonal body than planar designs. Look for headphones described as rich or full rather than analytical.',
    },
    defaultDirection: 'Prioritize components known for harmonic richness and tonal continuity over transient precision.',
    tradeoffs: [
      'Components that maximize tonal density may sacrifice some detail retrieval and transient edge.',
      'Very rich systems can sound congested if pushed too far.',
    ],
  },
  {
    check: (t) => t.clarity === 'up',
    label: 'detail, clarity, and resolution',
    directionByCategory: {
      dac: 'Delta-sigma DACs from ESS Sabre and AKM tend to excel at measured resolution. For a more natural form of detail, look at high-end R-2R implementations that resolve without etching.',
      amplifier: 'Amplifiers with wide bandwidth and low distortion reveal the most upstream detail. Class A/B and Class D designs with short feedback loops often score well on transparency.',
      speakers: 'Speakers with metal or beryllium tweeters and rigid cabinets tend to deliver the highest resolution. Monitor-style designs prioritize accuracy over tonal warmth.',
      headphones: 'Electrostatic and high-end planar headphones typically offer the highest resolution. Open-back designs reveal more spatial and micro-detail than closed designs.',
    },
    defaultDirection: 'Prioritize components known for transparency and information retrieval.',
    tradeoffs: [
      'Highly resolving systems can be fatiguing if any upstream component introduces edge or glare.',
      'Detail without sufficient tonal body can sound thin and clinical.',
    ],
  },
  {
    check: (t) => t.fatigue_risk === 'up' || t.glare_risk === 'up',
    label: 'reduced fatigue and smoother presentation',
    directionByCategory: {
      dac: 'Consider DACs known for smoothness and low fatigue — tube-output designs, NOS (non-oversampling) DACs, or R-2R implementations that soften digital edges.',
      amplifier: 'Tube amplifiers or Class A designs with gentle high-frequency rolloff can reduce perceived fatigue. Avoid very high-feedback designs if brightness is the issue.',
      speakers: 'Speakers with soft-dome tweeters or ribbon tweeters that extend without harshness can reduce fatigue. Avoid metal tweeters if glare is a concern.',
      headphones: 'Warm-tuned dynamic headphones with rolled-off treble tend to be less fatiguing. Avoid bright-signature planar headphones if long listening sessions matter.',
    },
    defaultDirection: 'Prioritize components known for smoothness and listening ease over analytical resolution.',
    tradeoffs: [
      'Reducing fatigue by softening the presentation can also reduce perceived detail and air.',
      'The source of fatigue may be upstream — fixing the wrong component leaves the root cause intact.',
    ],
  },
  {
    check: (t) => t.flow === 'up' && t.composure === 'up',
    label: 'smoothness, ease, and composure',
    directionByCategory: {
      dac: 'DACs with tube output stages or relaxed filter implementations tend to maximize ease. Look for designs described as musical or organic rather than analytical.',
      amplifier: 'Low-power Class A amplifiers and single-ended tube designs often deliver the greatest composure. They prioritize texture and flow over dynamic punch.',
      speakers: 'Speakers with gentle crossover slopes and natural-material drivers (paper, treated fiber) tend to sound more relaxed. BBC-heritage designs are a good starting point.',
    },
    defaultDirection: 'Prioritize components known for musical flow and composure over speed or analytical precision.',
    tradeoffs: [
      'Very composed systems can feel sleepy or lack dynamic contrast.',
      'Smoothness pushed too far can obscure musical detail and reduce engagement.',
    ],
  },
];

/**
 * Fallback taste profile when no specific trait pattern is detected.
 */
const FALLBACK_TASTE: Pick<TasteProfile, 'label' | 'defaultDirection' | 'tradeoffs'> = {
  label: 'a balanced presentation',
  defaultDirection: 'Look for components described as well-balanced or all-rounders. Avoid designs that strongly prioritize a single trait at the expense of others.',
  tradeoffs: [
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

// ── Builder ───────────────────────────────────────────

/**
 * Builds a structured shopping recommendation from the gathered
 * context and extracted signals. Deterministic, template-driven.
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

  // Build preference summary
  const preferenceSummary = ctx.budgetMentioned
    ? `You're looking for a ${categoryLabel} that prioritizes ${taste.label}.`
    : `You're looking for a ${categoryLabel} that prioritizes ${taste.label}.`;

  // Build direction
  const direction = matchedProfile?.directionByCategory[ctx.category]
    ?? taste.defaultDirection;

  // System-coherence note (only when system context was provided)
  const systemNote = ctx.systemProvided
    ? `How this interacts with your existing system depends on the character of your other components. A ${categoryLabel} change will shift the overall balance — listen for whether the qualities you value are preserved.`
    : null;

  return {
    preferenceSummary,
    direction,
    tradeoffs: taste.tradeoffs,
    systemNote,
  };
}
