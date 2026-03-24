/**
 * Conversation State Machine — Audio XX
 *
 * Manages the first 2–4 turns of every conversation with an explicit
 * state model. Replaces the scattered ref-based tracking (chipIntentRef,
 * awaitingListeningPathRef, onboardingContextRef, intakeShownRef) with
 * a single state object and deterministic transition logic.
 *
 * Core rules:
 *   1. Beginner/uncertain inputs → orientation, never diagnosis.
 *   2. Diagnosis requires system context before the engine runs.
 *   3. Shopping recommends immediately when intent is complete.
 */

// ── Types ──────────────────────────────────────────────

export type ConvMode =
  | 'idle'
  | 'orientation'
  | 'shopping'
  | 'diagnosis'
  | 'improvement'
  | 'comparison'
  | 'music_input'
  | 'system_assessment';

export type ConvStage =
  | 'entry'
  | 'clarify_category'
  | 'clarify_budget'
  | 'clarify_system'
  | 'clarify_preference'
  | 'clarify_symptom'
  | 'clarify_targets'
  | 'awaiting_listening_path'
  | 'awaiting_onboarding_followup'
  | 'ready_to_recommend'
  | 'ready_to_diagnose'
  | 'ready_to_compare'
  | 'done';

export interface ConvFacts {
  /** Product category: 'dac', 'speaker', 'headphone', 'amplifier', 'turntable', etc. */
  category?: string;
  /** Budget string (e.g. '$1000', 'under 500'). */
  budget?: string;
  /** Whether the user has an active/declared system. */
  hasSystem?: boolean;
  /** Preference or taste signal (genre, sound character, etc.). */
  preference?: string;
  /** Music description from music_input flow. */
  musicDescription?: string;
  /** Listening path from music_input flow. */
  listeningPath?: 'headphones' | 'speakers' | 'unknown';
  /** Symptom description for diagnosis. */
  symptom?: string;
  /** Comparison targets. */
  comparisonTargets?: string[];
  /** Number of detected product/brand subjects. */
  subjectCount?: number;
  /** User explicitly said they're starting from scratch / building new. */
  fromScratch?: boolean;
}

export interface ConvState {
  mode: ConvMode;
  stage: ConvStage;
  facts: ConvFacts;
}

/** A transition result: what to show the user and the updated state. */
export interface ConvTransition {
  /** Updated state after the transition. */
  state: ConvState;
  /** Response to show the user (null = fall through to normal pipeline). */
  response: ConvResponse | null;
}

export type ConvResponse =
  | { kind: 'question'; acknowledge: string; question: string }
  | { kind: 'note'; content: string }
  | { kind: 'proceed'; synthesizedQuery?: string };

// ── Initial state ──────────────────────────────────────

export const INITIAL_CONV_STATE: ConvState = {
  mode: 'idle',
  stage: 'entry',
  facts: {},
};

// ── Orientation detection ──────────────────────────────

const ORIENTATION_PATTERNS = [
  /\b(?:i\s+)?(?:want|need)\s+(?:a\s+)?better\s+(?:sound|audio|music|listening)/i,
  /\b(?:i\s+)?don'?t\s+know\s+what\s+(?:i\s+)?(?:need|want|like|should)/i,
  /\b(?:i'?m\s+)?not\s+sure\s+what\s+(?:i\s+)?(?:need|want|like|should)/i,
  /\bhelp\s+me\b(?!\s+(?:compare|find|choose|pick|decide|assess|evaluate|diagnose))/i,
  /\bwhat\s+should\s+i\s+(?:get|buy|start\s+with)\b/i,
  /\bi\s+(?:want|need)\s+(?:to\s+)?(?:get\s+)?(?:into|started)/i,
  /\b(?:i\s+)?(?:like|want)\s+(?:good|better|great|nice)\s+(?:sound|audio|music)\b/i,
  /\bi\s+(?:have|use)\s+(?:sonos|bose|soundbar|bluetooth|airpods|homepod|echo)\s+(?:but|and)\s+(?:want|need)/i,
  /\b(?:i\s+)?want\s+(?:an?\s+)?upgrade\b/i,
  /\bwhere\s+(?:do\s+i|should\s+i)\s+start\b/i,
  /\bi\s+like\s+everything\b/i,
];

export function isOrientationInput(text: string): boolean {
  return ORIENTATION_PATTERNS.some((p) => p.test(text));
}

// ── Budget extraction ──────────────────────────────────

const BUDGET_PATTERN = /(?:under\s+)?\$\s?\d[\d,]*|\bunder\s+\d[\d,]*\b|\bbudget\s+(?:of|around|is)\s+\$?\d[\d,]*/i;

/**
 * Relaxed budget pattern for when we've already asked "what's your budget?"
 * Accepts plain numbers like "5000", "2,000", "500", "around 2000" — contexts
 * where a number is almost certainly a budget figure.
 */
const PLAIN_BUDGET_PATTERN = /(?:around|about|roughly|maybe|approximately)?\s*\$?\s?(\d[\d,]{2,})/i;

function extractBudget(text: string): string | undefined {
  const match = text.match(BUDGET_PATTERN);
  if (!match) return undefined;
  // Normalize: strip "budget of/around/is" prefix, keep just the amount
  const raw = match[0];
  const normalized = raw.replace(/^budget\s+(?:of|around|is)\s+/i, '');
  // Ensure dollar sign
  return normalized.startsWith('$') || /^under\s/i.test(normalized)
    ? normalized
    : `$${normalized}`;
}

// ── Category detection (lightweight) ───────────────────

const CATEGORY_PATTERNS: Array<[RegExp, string]> = [
  [/\b(?:dac|d\/a|digital.to.analog)\b/i, 'dac'],
  [/\b(?:amp|amplifier|integrated|receiver)\b/i, 'amplifier'],
  [/\b(?:speaker|speakers|monitor|monitors|bookshelf|floorstander|tower)\b/i, 'speaker'],
  [/\b(?:headphone|headphones|cans|iems?|earbuds?|over.ear|on.ear)\b/i, 'headphone'],
  [/\b(?:turntable|vinyl|record\s+player|phono)\b/i, 'turntable'],
  [/\b(?:streamer|streaming|network\s+player)\b/i, 'streamer'],
];

function extractCategory(text: string): string | undefined {
  for (const [pattern, category] of CATEGORY_PATTERNS) {
    if (pattern.test(text)) return category;
  }
  return undefined;
}

// ── Preference / taste extraction ──────────────────────

function extractPreference(text: string): string | undefined {
  // Detect music genres, sound character words, or listening context
  const tastePatterns = [
    /\b(?:jazz|rock|classical|electronic|hip.?hop|metal|folk|pop|country|r&b|blues)\b/i,
    /\b(?:warm|bright|smooth|detailed|punchy|airy|musical|lush|analytical|neutral|energetic|relaxed)\b/i,
    /\b(?:small\s+room|apartment|desktop|nearfield|living\s+room|large\s+room)\b/i,
    /\b(?:low\s+volume|loud|quiet|late.night)\b/i,
  ];
  for (const p of tastePatterns) {
    const m = text.match(p);
    if (m) return m[0];
  }
  return undefined;
}

// ── Readiness checks ───────────────────────────────────

/** True when we have enough to produce shopping recommendations. */
export function isReadyToRecommend(facts: ConvFacts): boolean {
  if (!facts.category || facts.category === 'general') return false;
  // Need budget AND at least one other signal (preference or system)
  if (facts.budget && (facts.preference || facts.hasSystem)) return true;
  // Budget alone with category is enough for a focused recommendation
  if (facts.budget) return true;
  return false;
}

/** True when we have enough to run diagnosis. */
export function isReadyToDiagnose(facts: ConvFacts): boolean {
  return !!facts.symptom && !!facts.hasSystem;
}

/** True when we have enough to run a comparison. */
export function isReadyToCompare(facts: ConvFacts): boolean {
  return !!facts.comparisonTargets && facts.comparisonTargets.length >= 2;
}

// ── Transition logic ───────────────────────────────────

// ── Intent-change detection ─────────────────────────────
// Maps conversation modes to the intents they are compatible with.
// When a new intent arrives that is NOT in the compatible set,
// the state machine resets to idle with fresh facts.

const MODE_COMPATIBLE_INTENTS: Record<ConvMode, Set<string>> = {
  idle: new Set(), // idle accepts everything — never checked
  orientation: new Set(['shopping', 'diagnosis', 'intake', 'music_input', 'consultation_entry']),
  shopping: new Set(['shopping', 'intake', 'music_input']),
  diagnosis: new Set(['diagnosis', 'system_assessment', 'consultation_entry']),
  music_input: new Set(['music_input', 'shopping', 'intake']),
  improvement: new Set(['diagnosis', 'shopping', 'intake']),
  comparison: new Set(['comparison', 'exploration']),
  system_assessment: new Set(['system_assessment', 'diagnosis', 'consultation_entry']),
};

/**
 * Lightweight diagnosis signal check — returns true when the text
 * contains an explicit diagnostic pattern (complaint, symptom, etc.)
 * rather than falling through to the default "diagnosis" bucket
 * in detectIntent().
 */
const DIAGNOSIS_SIGNAL_PATTERNS = [
  /\bmy\s+(?:system|setup)\s+(?:sounds?|is|feels?)\b/i,
  /\bsounds?\s+(?:too\s+)?(?:bright|thin|harsh|fatiguing|muddy|dull|veiled|grainy|flat|boring|lifeless|congested|sibilant|dry|sterile|clinical|analytical|cold|hard|brittle|forward|strident|sharp|lean|aggressive)\b/i,
  /\btoo\s+(?:bright|thin|harsh|fatiguing|muddy|dull|veiled|grainy|flat|dry|sterile|clinical|analytical|cold|hard|forward|strident|sharp|lean|aggressive)\b/i,
  /\black(?:s|ing)\s+/i,
  /\blistening\s+fatigue\b/i,
  /\bnot\s+(?:enough|happy|satisfied)\b/i,
  /\bsomething\s+(?:is\s+|feels?\s+)?(?:off|wrong|missing)\b/i,
  /\b(?:problem|issue)\s+with\b/i,
];

function hasExplicitDiagnosisSignal(text: string): boolean {
  return DIAGNOSIS_SIGNAL_PATTERNS.some((p) => p.test(text));
}

/**
 * Returns true when the user explicitly requests evaluation/assessment
 * of their system — "evaluate my system", "strengths and weaknesses",
 * "how does it sound", "full assessment", etc.
 *
 * This is distinct from diagnosis (symptom-based) and improvement (goal-based).
 * Evaluation requests should skip clarification and run immediately.
 */
const EVALUATION_LANGUAGE_PATTERNS = [
  /\bevaluat/i,
  /\bassess(?:ment)?\b/i,
  /\bstrengths?\b.*\bweakness/i,
  /\bweakness.*\bstrengths?\b/i,
  /\breview\s+(?:my|the)\s+(?:system|setup|rig|chain)\b/i,
  /\bhow\s+does\s+(?:it|my\s+(?:system|setup))\s+sound\b/i,
  /\bfull\s+(?:assessment|evaluation|review|analysis)\b/i,
  /\bwhat\s+(?:do\s+you\s+think|are\s+the\s+(?:strengths?|weaknesses?))\b/i,
  /\banalyze\s+(?:my|the)\s+(?:system|setup|rig|chain)\b/i,
  /\brate\s+(?:my|the)\s+(?:system|setup|rig|chain)\b/i,
  /\bopinion\s+on\s+(?:my|the)\s+(?:system|setup|rig|chain)\b/i,
];

function hasExplicitEvaluationLanguage(text: string): boolean {
  return EVALUATION_LANGUAGE_PATTERNS.some((p) => p.test(text));
}

/**
 * Returns true when the detected intent is clearly incompatible
 * with the active conversation mode.
 *
 * Only strong, recognized intents trigger a reset. Unknown/ambiguous
 * intents never cause the state to clear.
 *
 * Special-case: 'diagnosis' is the default fallback in detectIntent() —
 * bare numbers, ambiguous text, etc. all return diagnosis. We only treat
 * it as a mismatch when the text contains an explicit diagnosis signal.
 */
function isIntentMismatch(mode: ConvMode, detectedIntent: string, text?: string): boolean {
  if (mode === 'idle') return false;
  const compatible = MODE_COMPATIBLE_INTENTS[mode];
  if (!compatible) return false;

  const STRONG_INTENTS = new Set([
    'shopping', 'comparison', 'music_input', 'intake',
    'system_assessment', 'consultation_entry', 'exploration',
    'product_assessment', 'cable_advisory',
  ]);

  if (detectedIntent === 'diagnosis') {
    if (!text || !hasExplicitDiagnosisSignal(text)) return false;
    return !compatible.has('diagnosis');
  }

  if (!STRONG_INTENTS.has(detectedIntent)) return false;
  return !compatible.has(detectedIntent);
}

/**
 * Given current state and new user input, compute the next state + response.
 *
 * Returns `response: null` when the state machine defers to the normal
 * pipeline (for ready_to_recommend, ready_to_diagnose, ready_to_compare, etc.).
 */
export function transition(
  current: ConvState,
  text: string,
  context: {
    hasSystem: boolean;
    subjectCount: number;
    detectedIntent?: string;
  },
): ConvTransition {
  // ── Intent-change detection ────────────────────────────
  // When the user's new intent is clearly incompatible with the
  // active conversation mode, reset to idle with fresh facts.
  // This prevents stale category/budget/system data from leaking
  // across unrelated flows (e.g. DAC shopping → KEF vs ELAC comparison).
  if (context.detectedIntent && isIntentMismatch(current.mode, context.detectedIntent, text)) {
    return {
      state: INITIAL_CONV_STATE,
      response: null,
    };
  }

  const facts = { ...current.facts };
  facts.hasSystem = context.hasSystem || facts.hasSystem;
  facts.subjectCount = context.subjectCount;

  // Always extract what we can from every message
  const newCategory = extractCategory(text);
  const newBudget = extractBudget(text);
  const newPreference = extractPreference(text);
  if (newCategory) facts.category = newCategory;
  if (newBudget) facts.budget = newBudget;
  if (newPreference) facts.preference = newPreference;

  // ── Mode-specific transitions ────────────────────────

  switch (current.mode) {

    // ── ORIENTATION ────────────────────────────────────
    case 'orientation': {
      // User replied to "buying new or improving what you have?"
      const wantsBuy = /\b(?:buy|new|shop|looking\s+for|get\s+(?:a|some))\b/i.test(text);
      const wantsImprove = /\b(?:improve|upgrade|fix|change|better|replace)\b/i.test(text);
      const wantsDiagnose = /\b(?:sounds?\s+(?:off|bad|wrong|thin|bright|muddy)|problem|issue|something.*off)\b/i.test(text);

      if (wantsBuy || facts.category) {
        // Transition to shopping
        if (facts.category && facts.budget) {
          return {
            state: { mode: 'shopping', stage: 'ready_to_recommend', facts },
            response: { kind: 'proceed' },
          };
        }
        if (facts.category) {
          return {
            state: { mode: 'shopping', stage: 'clarify_budget', facts },
            response: {
              kind: 'question',
              acknowledge: `Got it — ${facts.category === 'dac' ? 'a DAC' : facts.category === 'amplifier' ? 'an amplifier' : facts.category + 's'}.`,
              question: "What's your budget?",
            },
          };
        }
        return {
          state: { mode: 'shopping', stage: 'clarify_category', facts },
          response: {
            kind: 'question',
            acknowledge: 'Got it — let\'s find something good.',
            question: 'What are you looking for? Speakers, headphones, a DAC, an amplifier, or a turntable?',
          },
        };
      }

      if (wantsDiagnose) {
        facts.symptom = text;
        if (facts.hasSystem) {
          return {
            state: { mode: 'diagnosis', stage: 'ready_to_diagnose', facts },
            response: { kind: 'proceed' },
          };
        }
        return {
          state: { mode: 'diagnosis', stage: 'clarify_system', facts },
          response: {
            kind: 'question',
            acknowledge: `Understood — "${text.length > 60 ? text.slice(0, 57) + '...' : text}."`,
            question: "What's in your system? Knowing the main components will help me pinpoint where this is coming from.",
          },
        };
      }

      if (wantsImprove) {
        if (facts.hasSystem) {
          return {
            state: { mode: 'improvement', stage: 'clarify_preference', facts },
            response: {
              kind: 'question',
              acknowledge: 'Got it — let\'s figure out what would make the biggest difference.',
              question: 'What feels like the main limitation right now? For example: not enough bass, too bright, not engaging enough, or just wanting more detail.',
            },
          };
        }
        return {
          state: { mode: 'improvement', stage: 'clarify_system', facts },
          response: {
            kind: 'question',
            acknowledge: 'Got it — let\'s see what would make the biggest difference.',
            question: "What's in your system right now? List the main components — source, DAC, amp, speakers — and I'll identify where to focus.",
          },
        };
      }

      // Unclear reply — ask more specifically
      return {
        state: { mode: 'orientation', stage: 'entry', facts },
        response: {
          kind: 'question',
          acknowledge: 'No problem.',
          question: 'Are you trying to buy something new, improve what you already have, or fix a problem you\'re hearing?',
        },
      };
    }

    // ── SHOPPING ───────────────────────────────────────
    case 'shopping': {
      // Relaxed budget extraction: when we've already asked for budget,
      // accept plain numbers like "5000", "around 2000" as budget figures.
      // Must run BEFORE isReadyToRecommend so synthesizedQuery generation fires.
      if (current.stage === 'clarify_budget' && !facts.budget) {
        const plainMatch = text.match(PLAIN_BUDGET_PATTERN);
        if (plainMatch) {
          facts.budget = `$${plainMatch[1]}`;
        }
      }

      if (isReadyToRecommend(facts)) {
        // If we accumulated music context from the onboarding flow,
        // synthesize a rich query so the shopping pipeline has full context.
        if (facts.musicDescription) {
          const category = facts.listeningPath === 'headphones' ? 'headphones' : 'speakers';
          const musicPart = facts.musicDescription.replace(/^i\s+(listen\s+to|like|love|enjoy)\s+/i, '');
          const budgetPart = facts.budget
            ? ` under ${facts.budget.replace(/^under\s*/i, '')}`
            : '';
          const scratchPart = facts.fromScratch ? ' Starting from scratch.' : '';
          const synthesized = `I listen to ${musicPart}. Looking for ${category}${budgetPart}.${scratchPart}`;
          return {
            state: { mode: 'shopping', stage: 'ready_to_recommend', facts },
            response: { kind: 'proceed', synthesizedQuery: synthesized },
          };
        }
        return {
          state: { mode: 'shopping', stage: 'ready_to_recommend', facts },
          response: { kind: 'proceed' },
        };
      }

      if (current.stage === 'clarify_category') {
        if (!facts.category) {
          // Still no category — ask again
          return {
            state: { mode: 'shopping', stage: 'clarify_category', facts },
            response: {
              kind: 'question',
              acknowledge: 'Got it.',
              question: 'What type of component? Speakers, headphones, DAC, amplifier, or turntable?',
            },
          };
        }
        // Have category — now need budget
        return {
          state: { mode: 'shopping', stage: 'clarify_budget', facts },
          response: {
            kind: 'question',
            acknowledge: categoryAcknowledge(facts.category),
            question: "What's your budget? And do you have an existing system these need to work with?",
          },
        };
      }

      if (current.stage === 'clarify_budget') {
        if (facts.budget) {
          // Budget received — ready
          return {
            state: { mode: 'shopping', stage: 'ready_to_recommend', facts },
            response: { kind: 'proceed' },
          };
        }
        // No budget detected — try once more
        return {
          state: { mode: 'shopping', stage: 'clarify_budget', facts },
          response: {
            kind: 'question',
            acknowledge: 'Got it.',
            question: 'Roughly what budget are you working with?',
          },
        };
      }

      // Default: check readiness
      if (facts.category) {
        return {
          state: { mode: 'shopping', stage: 'clarify_budget', facts },
          response: {
            kind: 'question',
            acknowledge: categoryAcknowledge(facts.category),
            question: "What's your budget?",
          },
        };
      }

      return {
        state: { mode: 'shopping', stage: 'clarify_category', facts },
        response: {
          kind: 'question',
          acknowledge: 'Got it — let\'s find something good.',
          question: 'What are you looking for? Speakers, headphones, a DAC, an amplifier, or a turntable?',
        },
      };
    }

    // ── DIAGNOSIS ──────────────────────────────────────
    case 'diagnosis': {
      if (current.stage === 'clarify_system') {
        // User provided system details
        facts.hasSystem = facts.hasSystem || context.subjectCount > 0;
        if (facts.hasSystem) {
          return {
            state: { mode: 'diagnosis', stage: 'ready_to_diagnose', facts },
            response: { kind: 'proceed' },
          };
        }
        // Still no system detected
        return {
          state: { mode: 'diagnosis', stage: 'clarify_system', facts },
          response: {
            kind: 'question',
            acknowledge: 'Got it.',
            question: 'Can you name the specific components? For example: "Bluesound Node, Hegel H190, KEF Q350."',
          },
        };
      }

      if (current.stage === 'clarify_symptom') {
        facts.symptom = text;
        if (facts.hasSystem) {
          return {
            state: { mode: 'diagnosis', stage: 'ready_to_diagnose', facts },
            response: { kind: 'proceed' },
          };
        }
        return {
          state: { mode: 'diagnosis', stage: 'clarify_system', facts },
          response: {
            kind: 'question',
            acknowledge: `"${text.length > 60 ? text.slice(0, 57) + '...' : text}" — got it.`,
            question: "What's in your system? List the main components so I can pinpoint what's likely causing this.",
          },
        };
      }

      // Ready
      if (isReadyToDiagnose(facts)) {
        return {
          state: { mode: 'diagnosis', stage: 'ready_to_diagnose', facts },
          response: { kind: 'proceed' },
        };
      }

      // Fallback
      return {
        state: { mode: 'diagnosis', stage: 'clarify_system', facts },
        response: {
          kind: 'question',
          acknowledge: 'Got it.',
          question: "What's in your system?",
        },
      };
    }

    // ── IMPROVEMENT ────────────────────────────────────
    case 'improvement': {
      if (current.stage === 'clarify_system') {
        facts.hasSystem = facts.hasSystem || context.subjectCount > 0;
        if (facts.hasSystem) {
          return {
            state: { mode: 'improvement', stage: 'clarify_preference', facts },
            response: {
              kind: 'question',
              acknowledge: 'Got it.',
              question: 'What feels like the main limitation? For example: not enough bass, too bright, not engaging, or wanting more detail.',
            },
          };
        }
        return {
          state: { mode: 'improvement', stage: 'clarify_system', facts },
          response: {
            kind: 'question',
            acknowledge: 'Got it.',
            question: 'Can you name the specific components? For example: "Bluesound Node, Hegel H190, KEF Q350."',
          },
        };
      }

      if (current.stage === 'clarify_preference') {
        // They've told us what to improve — route to system assessment or consultation
        return {
          state: { mode: 'improvement', stage: 'done', facts },
          response: { kind: 'proceed' },
        };
      }

      // Default: ask for system
      if (!facts.hasSystem) {
        return {
          state: { mode: 'improvement', stage: 'clarify_system', facts },
          response: {
            kind: 'question',
            acknowledge: 'Let\'s see what would make the biggest difference.',
            question: "What's in your system right now?",
          },
        };
      }

      return {
        state: { mode: 'improvement', stage: 'clarify_preference', facts },
        response: {
          kind: 'question',
          acknowledge: 'Got it.',
          question: 'What feels like the main limitation right now?',
        },
      };
    }

    // ── COMPARISON ─────────────────────────────────────
    case 'comparison': {
      // Track detected subjects as comparison targets
      if (context.subjectCount >= 2) {
        facts.comparisonTargets = ['detected', 'detected']; // Placeholder — actual names come from turnCtx
        return {
          state: { mode: 'comparison', stage: 'ready_to_compare', facts },
          response: { kind: 'proceed' },
        };
      }

      if (context.subjectCount === 1) {
        return {
          state: { mode: 'comparison', stage: 'clarify_targets', facts },
          response: {
            kind: 'question',
            acknowledge: 'Got it — one down.',
            question: 'What do you want to compare it against?',
          },
        };
      }

      return {
        state: { mode: 'comparison', stage: 'clarify_targets', facts },
        response: {
          kind: 'question',
          acknowledge: 'Sure — let\'s compare.',
          question: 'Which two components are you deciding between?',
        },
      };
    }

    // ── MUSIC INPUT ────────────────────────────────────
    case 'music_input': {
      if (current.stage === 'awaiting_listening_path') {
        // Detect headphones / speakers from reply
        const lower = text.toLowerCase();
        if (/\b(headphone|headphones|cans|iems|earbuds|airpods)\b/.test(lower)) {
          facts.listeningPath = 'headphones';
          facts.category = 'headphone';
        } else if (/\b(speaker|speakers|stereo|hifi|hi-fi|system|room)\b/.test(lower)) {
          facts.listeningPath = 'speakers';
          facts.category = 'speaker';
        } else {
          facts.listeningPath = 'unknown';
        }

        const pathResponse = facts.listeningPath === 'headphones'
          ? 'Got it. Do you already have headphones you like, or are you looking for new ones?'
          : facts.listeningPath === 'speakers'
            ? 'Got it. Do you already have speakers or gear you want to improve around, or are you starting from scratch?'
            : 'No problem. Are you mostly using headphones, speakers, or a bit of both?';

        return {
          state: { mode: 'music_input', stage: 'awaiting_onboarding_followup', facts },
          response: { kind: 'note', content: pathResponse },
        };
      }

      if (current.stage === 'awaiting_onboarding_followup') {
        // Third turn: user answers about existing gear or starting fresh
        const category = facts.listeningPath === 'headphones' ? 'headphones' : 'speakers';
        const categoryLabel = category === 'headphones' ? 'headphones' : 'a speaker setup';
        const musicDesc = facts.musicDescription ?? '';

        // Detect "from scratch" / "starting fresh" / "don't have any" signals
        const FROM_SCRATCH_PATTERN = /\b(?:from\s+scratch|starting\s+(?:fresh|out|new)|don'?t\s+have\s+(?:any|a)|no\s+(?:system|gear|equipment|setup)|first\s+(?:system|setup)|building\s+(?:new|a\s+new)|brand\s+new)\b/i;
        if (FROM_SCRATCH_PATTERN.test(text)) {
          facts.fromScratch = true;
        }

        // Extract budget from this message
        if (newBudget) facts.budget = newBudget;

        // If we have budget, synthesize and recommend
        if (facts.budget) {
          const musicPart = musicDesc.replace(/^i\s+(listen\s+to|like|love|enjoy)\s+/i, '');
          const budgetPart = ` under ${facts.budget.replace(/^under\s*/i, '')}`;
          const scratchPart = facts.fromScratch ? ' Starting from scratch.' : '';
          const synthesized = `I listen to ${musicPart}. Looking for ${category}${budgetPart}.${scratchPart}`;
          return {
            state: { mode: 'shopping', stage: 'ready_to_recommend', facts },
            response: { kind: 'proceed', synthesizedQuery: synthesized },
          };
        }

        // No budget yet — stay in shopping mode and ask for budget.
        // "Starting from scratch" / "looking for new ones" / "don't have any"
        // are directional signals, not purchase-ready.
        return {
          state: { mode: 'shopping', stage: 'clarify_budget', facts },
          response: {
            kind: 'question',
            acknowledge: `Great — let's find ${categoryLabel} for that kind of listening.`,
            question: "What's your budget?",
          },
        };
      }

      // Shouldn't reach here — entry is handled by detectInitialMode
      return {
        state: current,
        response: null,
      };
    }

    // ── SYSTEM ASSESSMENT (system entry) ────────────────
    case 'system_assessment': {
      if (current.stage === 'entry') {
        facts.hasSystem = true;
        // If the original message already contained evaluation language
        // (e.g. "evaluate my system: ..."), skip clarification entirely.
        // The text var here is the user's NEXT message (after entry was set
        // by detectInitialMode), but we also check the original facts
        // for evaluation intent carried from detectInitialMode.
        if (hasExplicitEvaluationLanguage(text)) {
          facts.symptom = text;
          return {
            state: { mode: 'diagnosis', stage: 'ready_to_diagnose', facts },
            response: { kind: 'proceed' },
          };
        }
        // No explicit evaluation intent — ask what they want to do.
        return {
          state: { mode: 'system_assessment', stage: 'clarify_preference', facts },
          response: {
            kind: 'question',
            acknowledge: 'Got it — that\'s your system.',
            question: 'What are you trying to improve or change about it?',
          },
        };
      }

      if (current.stage === 'clarify_preference') {
        // User told us what they want to improve — check if it's a symptom, evaluation, or a goal
        const wantsDiagnose = /\b(?:sounds?\s+(?:off|bad|wrong|thin|bright|muddy|harsh)|problem|issue|something.*off|fatiguing|lacking)\b/i.test(text);
        const wantsEvaluation = hasExplicitEvaluationLanguage(text);
        const wantsBuy = /\b(?:buy|new|shop|looking\s+for|get\s+(?:a|some)|upgrade|replace|add)\b/i.test(text);

        if (wantsDiagnose || wantsEvaluation) {
          facts.symptom = text;
          return {
            state: { mode: 'diagnosis', stage: 'ready_to_diagnose', facts },
            response: { kind: 'proceed' },
          };
        }

        if (wantsBuy && facts.category && facts.budget) {
          return {
            state: { mode: 'shopping', stage: 'ready_to_recommend', facts },
            response: { kind: 'proceed' },
          };
        }

        if (wantsBuy && facts.category) {
          return {
            state: { mode: 'shopping', stage: 'clarify_budget', facts },
            response: {
              kind: 'question',
              acknowledge: categoryAcknowledge(facts.category),
              question: "What's your budget?",
            },
          };
        }

        if (wantsBuy) {
          return {
            state: { mode: 'shopping', stage: 'clarify_category', facts },
            response: {
              kind: 'question',
              acknowledge: 'Got it — let\'s find the right upgrade.',
              question: 'What component are you looking to change? DAC, amplifier, speakers, headphones, or something else?',
            },
          };
        }

        // General improvement goal — fall through to consultation pipeline
        return {
          state: { mode: 'improvement', stage: 'done', facts },
          response: { kind: 'proceed' },
        };
      }

      // Default: fall through to pipeline
      return { state: current, response: null };
    }

    // ── IDLE / OTHER ────────────────────────────────────
    default:
      return { state: current, response: null };
  }
}

// ── Initial mode detection ─────────────────────────────

/**
 * Determines the initial mode from the user's first message.
 * Called when convState.mode === 'idle'.
 *
 * Returns a new ConvState with mode and stage set, or null to
 * defer to the normal pipeline.
 */
export function detectInitialMode(
  text: string,
  context: {
    detectedIntent: string;
    hasSystem: boolean;
    subjectCount: number;
  },
): ConvState | null {
  const facts: ConvFacts = {
    hasSystem: context.hasSystem,
    subjectCount: context.subjectCount,
    category: extractCategory(text),
    budget: extractBudget(text),
    preference: extractPreference(text),
  };

  // Rule 3: Beginner uncertainty → orientation
  if (isOrientationInput(text)) {
    return { mode: 'orientation', stage: 'entry', facts };
  }

  // Music input
  if (context.detectedIntent === 'music_input') {
    facts.musicDescription = text;
    return { mode: 'music_input', stage: 'awaiting_listening_path', facts };
  }

  // Diagnosis: detect symptom-based inputs
  if (context.detectedIntent === 'diagnosis') {
    facts.symptom = text;
    // If the user named components in this message, treat as system-provided.
    // This prevents asking "what's in your system?" when they already told us.
    if (context.subjectCount >= 1) {
      facts.hasSystem = true;
    }
    // Rule 1: No diagnosis without system
    if (!facts.hasSystem) {
      return { mode: 'diagnosis', stage: 'clarify_system', facts };
    }
    return { mode: 'diagnosis', stage: 'ready_to_diagnose', facts };
  }

  // Shopping with complete intent → skip clarification
  if (context.detectedIntent === 'shopping') {
    if (isReadyToRecommend(facts)) {
      return { mode: 'shopping', stage: 'ready_to_recommend', facts };
    }
    // Explicit purchase intent ("buy a DAC", "purchase speakers") — recommend
    // immediately with an exploratory set rather than asking for budget first.
    // The follow-up question will offer to narrow by budget/system.
    const hasExplicitPurchase = /\b(?:buy|purchase|shop\s+for|shopping\s+for|pick\s+up|recommend|suggest)\b/i.test(text);
    if (facts.category && hasExplicitPurchase) {
      return { mode: 'shopping', stage: 'ready_to_recommend', facts };
    }
    if (facts.category) {
      return { mode: 'shopping', stage: 'clarify_budget', facts };
    }
    return { mode: 'shopping', stage: 'clarify_category', facts };
  }

  // Intake (vague shopping) → check if we should route to orientation
  if (context.detectedIntent === 'intake') {
    // If they have specifics (category or budget), route to shopping
    if (facts.category || facts.budget) {
      if (isReadyToRecommend(facts)) {
        return { mode: 'shopping', stage: 'ready_to_recommend', facts };
      }
      return { mode: 'shopping', stage: facts.category ? 'clarify_budget' : 'clarify_category', facts };
    }
    // Otherwise treat as orientation
    return { mode: 'orientation', stage: 'entry', facts };
  }

  // Comparison
  if (context.detectedIntent === 'comparison') {
    if (context.subjectCount >= 2) {
      return { mode: 'comparison', stage: 'ready_to_compare', facts };
    }
    return { mode: 'comparison', stage: 'clarify_targets', facts };
  }

  // System entry — user describes their components.
  // When the user explicitly asks for evaluation/assessment AND provides
  // their system, skip clarification and go straight to diagnosis.
  if (context.detectedIntent === 'system_assessment') {
    facts.hasSystem = true;
    if (hasExplicitEvaluationLanguage(text)) {
      facts.symptom = text;
      return { mode: 'diagnosis', stage: 'ready_to_diagnose', facts };
    }
    return { mode: 'system_assessment', stage: 'entry', facts };
  }

  // Consultation entry — user asks for system guidance without naming gear
  if (context.detectedIntent === 'consultation_entry') {
    return { mode: 'system_assessment', stage: 'entry', facts };
  }

  // Everything else: defer to normal pipeline
  return null;
}

// ── Helpers ────────────────────────────────────────────

/** Category display mapping for user-facing text. */
const CATEGORY_DISPLAY: Record<string, string> = {
  dac: 'a DAC',
  amplifier: 'an amplifier',
  speaker: 'speakers',
  headphone: 'headphones',
  turntable: 'a turntable',
  streamer: 'a streamer',
};

function categoryAcknowledge(category: string): string {
  const label = CATEGORY_DISPLAY[category] ?? category;
  return `Got it — looking for ${label}.`;
}
