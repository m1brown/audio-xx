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
  | 'assembling_system'
  | 'ready_to_recommend'
  | 'ready_to_diagnose'
  | 'ready_to_compare'
  | 'ready_to_assess'
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
  /** Accumulated system component descriptions for system_assessment mode. */
  systemComponents?: string[];
  /** All user text collected during system_assessment (for re-running assessment). */
  systemAssessmentText?: string;
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

const BUDGET_PATTERN = /(?:under\s+)?\$\s?\d[\d,]*(?:\.\d{1,2})?\s*k?\b|\bunder\s+\d[\d,]*\s*k?\b|\bbudget\s+(?:of|around|is)\s+\$?\d[\d,]*(?:\.\d{1,2})?\s*k?\b/i;

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
  let normalized = raw.replace(/^budget\s+(?:of|around|is)\s+/i, '');

  // Expand "k" suffix: "$5k" → "$5000", "under 2.5k" → "under $2500"
  const kMatch = normalized.match(/(\d+(?:\.\d{1,2})?)\s*k\b/i);
  if (kMatch) {
    const expanded = Math.round(parseFloat(kMatch[1]) * 1000);
    normalized = normalized.replace(/\d+(?:\.\d{1,2})?\s*k\b/i, String(expanded));
  }

  // Ensure dollar sign
  return normalized.startsWith('$') || /^under\s/i.test(normalized)
    ? normalized
    : `$${normalized}`;
}

// ── Category detection (lightweight) ───────────────────

const CATEGORY_PATTERNS: Array<[RegExp, string]> = [
  [/\b(?:dacs?|d\/a|digital.to.analog)\b/i, 'dac'],
  [/\b(?:amps?|amplifiers?|integrated|receivers?)\b/i, 'amplifier'],
  [/\b(?:speakers?|monitors?|bookshelf|floorstanders?|towers?)\b/i, 'speaker'],
  [/\b(?:headphones?|cans|iems?|earbuds?|over.ear|on.ear)\b/i, 'headphone'],
  [/\b(?:turntables?|vinyl|record\s+player|phono)\b/i, 'turntable'],
  [/\b(?:streamers?|streaming|network\s+player)\b/i, 'streamer'],
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

// ── From-scratch detection ────────────────────────────

const FROM_SCRATCH_PATTERN = /\b(?:from\s+scratch|starting\s+(?:fresh|out|new)|don'?t\s+have\s+(?:any|a)|no\s+(?:system|gear|equipment|setup)|first\s+(?:system|setup)|building\s+(?:new|a\s+new)|brand\s+new)\b/i;

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
  return !!facts.symptom;
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
  diagnosis: new Set(['diagnosis', 'system_assessment', 'consultation_entry', 'gear_inquiry', 'intake']),
  music_input: new Set(['music_input', 'shopping', 'intake']),
  improvement: new Set(['diagnosis', 'shopping', 'intake']),
  comparison: new Set(['comparison', 'exploration']),
  system_assessment: new Set(['system_assessment', 'diagnosis', 'consultation_entry', 'shopping', 'intake']),
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

/**
 * Lighter symptom-word check for use when already inside diagnosis mode.
 * Matches standalone symptom adjectives like "bright and fatiguing", "harsh",
 * "thin and dry". Too broad for general intent detection, but safe when the
 * state machine has already confirmed diagnosis context.
 */
const SYMPTOM_KEYWORD_PATTERN = /\b(?:bright|thin|harsh|fatiguing|muddy|dull|veiled|grainy|flat|boring|lifeless|congested|sibilant|dry|sterile|clinical|analytical|cold|hard|brittle|forward|strident|sharp|lean|aggressive)\b/i;

function hasSymptomKeyword(text: string): boolean {
  return SYMPTOM_KEYWORD_PATTERN.test(text);
}

function hasExplicitDiagnosisSignal(text: string): boolean {
  return DIAGNOSIS_SIGNAL_PATTERNS.some((p) => p.test(text));
}

// ── Symptom interpretation ──────────────────────────────
// Maps common symptom keywords to brief architectural interpretations.
// Used to acknowledge symptoms intelligently before asking for system details.

const SYMPTOM_INTERPRETATIONS: Array<[RegExp, string]> = [
  [/\bthin\b/i, 'Thin usually points to tonal balance — lightweight bass, lean midrange, or a mismatch between source and amplification.'],
  [/\bdry\b/i, 'Dry often comes from a system that strips harmonic overtones — high-feedback amplification, overly analytical sources, or aggressive room treatment.'],
  [/\bbright\b.*\bfatigu/i, 'Brightness with fatigue usually traces to compounded energy in the upper frequencies — source, amplification, and speakers all pushing the same direction.'],
  [/\bfatigu/i, 'Listening fatigue typically points to excess upper-midrange energy, poor damping interaction, or compounded brightness in the signal chain.'],
  [/\bbright\b/i, 'Brightness usually comes from tonal balance — energy concentrated in the upper frequencies, often compounded across multiple components.'],
  [/\bharsh\b/i, 'Harshness typically originates from distortion or resonance in the upper midrange — amplifier clipping, crossover artifacts, or room reflections can all contribute.'],
  [/\bmuddy\b/i, 'Muddiness usually means excess low-mid energy or poor bass control — room modes, underdamped speakers, or warm components stacking up.'],
  [/\bdull\b/i, 'A dull or lifeless sound often comes from over-smoothing — too much warmth, excessive damping, or detail being lost in the source or cable path.'],
  [/\bveiled\b/i, 'A veiled quality usually traces to something masking fine detail — cable losses, a warm DAC compounding a warm amp, or driver limitations.'],
  [/\bcongested\b/i, 'Congestion typically points to a system that compresses spatial and dynamic information — inadequate amplifier headroom, room overload, or overly warm voicing.'],
  [/\bsibilan/i, 'Sibilance usually comes from a peak in the presence region — tweeter behavior, crossover alignment, or a source that over-emphasizes transients.'],
  [/\bsterile\b|\bclinical\b|\bcold\b/i, 'A sterile or clinical sound usually means the system prioritizes precision over musicality — high feedback, neutral voicing with no warmth offset.'],
  [/\bflat\b|\bboring\b|\blifeless\b/i, 'A flat or lifeless presentation often means the system is over-controlled — dynamic compression, excessive damping, or components that smooth out musical energy.'],
  [/\blacking\b|\bmissing\b/i, 'That sense of something missing usually comes from a gap in the system\'s voicing — knowing the components helps identify where the loss originates.'],
  [/\baggressive\b|\bforward\b|\bstrident\b/i, 'An aggressive or forward sound usually traces to upper-midrange emphasis — speaker directivity, amplifier voicing, or room reflections compounding.'],
];

/**
 * Produces a brief architectural interpretation of the symptom described in the
 * user's text. Returns a generic fallback if no specific pattern matches.
 */
export function interpretSymptom(text: string): string {
  for (const [pattern, interpretation] of SYMPTOM_INTERPRETATIONS) {
    if (pattern.test(text)) return interpretation;
  }
  return 'That kind of issue usually traces to a specific interaction in the signal chain — tonal balance, damping, or component voicing.';
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
 * Detects whether the user is describing system components rather than
 * expressing a preference, symptom, or buying intent. Used in
 * system_assessment mode to keep assembling the system when the user
 * lists or clarifies components.
 *
 * Returns true when the text mentions audio component categories
 * (amp, speaker, DAC, etc.) or uses ownership + pairing language
 * ("I pair it with", "my amp is", "running a").
 */
const COMPONENT_DESCRIPTION_PATTERNS = [
  // Explicit component categories
  /\b(?:amp(?:lifier)?|integrated(?:\s+amp(?:lifier)?)?|speaker|speakers|dac|d\/a|streamer|turntable|phono|preamp|pre-amp|power\s+amp|headphone|headphones|source|transport|cd\s+player)\b/i,
  // Pairing / combining language
  /\b(?:pair(?:ed|ing)?\s+(?:it\s+)?with|paired\s+with|running\s+(?:a|an|the)|using\s+(?:a|an|the)|hooked\s+(?:up\s+)?to|connected\s+to|feeding\s+(?:a|an|the|into))\b/i,
  // Ownership of specific gear
  /\b(?:my|the)\s+(?:amp|amplifier|speakers?|dac|streamer|turntable|source|preamp)\b/i,
  // Arrow chain notation (e.g., "Node → Hugo → Job → Diva")
  /(?:→|-{1,3}>|={1,2}>|>{2,3})/,
];

function hasComponentDescription(text: string): boolean {
  return COMPONENT_DESCRIPTION_PATTERNS.some((p) => p.test(text));
}

/**
 * Counts major system roles mentioned in text.
 * Returns the number of distinct roles (source, amplification, output).
 */
function countSystemRoles(text: string): { source: boolean; amplification: boolean; output: boolean } {
  const lower = text.toLowerCase();
  return {
    source: /\b(?:dac|d\/a|streamer|turntable|phono|cd\s+player|transport|source|node|wiim)\b/i.test(lower),
    amplification: /\b(?:amp(?:lifier)?|integrated|preamp|pre-amp|power\s+amp|receiver)\b/i.test(lower),
    output: /\b(?:speaker|speakers|headphone|headphones|monitor|monitors)\b/i.test(lower),
  };
}

function getMissingRoles(text: string): string[] {
  const roles = countSystemRoles(text);
  const missing: string[] = [];
  if (!roles.source) missing.push('source (DAC, streamer, or turntable)');
  if (!roles.amplification) missing.push('amplifier');
  if (!roles.output) missing.push('speakers or headphones');
  return missing;
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
    const freshMode = detectInitialMode(text, context);
    return {
      state: freshMode ?? INITIAL_CONV_STATE,
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

  // Detect "from scratch" / "starting fresh" signals on every turn
  if (!facts.fromScratch && FROM_SCRATCH_PATTERN.test(text)) {
    facts.fromScratch = true;
  }

  // ── Onboarding bypass — sufficient signals skip remaining questions ──
  // If accumulated facts already contain budget + category (non-general),
  // there is no reason to keep asking onboarding questions. Jump straight
  // to ready_to_recommend regardless of which mode/stage we're currently in.
  // This handles multi-turn accumulation: Turn 1 "I listen to Van Halen",
  // Turn 2 "speakers, $5k" → category+budget now present → skip.
  const bypassCategory = facts.category && facts.category !== 'general';
  const bypassBudget = !!facts.budget;
  const bypassListeningPath = facts.listeningPath === 'headphones' || facts.listeningPath === 'speakers';
  const shouldBypass =
    (bypassBudget && bypassCategory) ||                        // budget + category
    (bypassBudget && bypassListeningPath) ||                   // budget + output type
    (bypassCategory && !!facts.musicDescription && bypassBudget); // music + category + budget

  if (shouldBypass && current.stage !== 'ready_to_recommend' && current.stage !== 'done') {
    // Default category from listening path if not explicitly set
    if (!bypassCategory && bypassListeningPath) {
      facts.category = facts.listeningPath === 'headphones' ? 'headphone' : 'speaker';
    }
    if (facts.musicDescription || facts.preference) {
      facts.musicDescription = facts.musicDescription ?? text;
    }
    console.log("[onboarding-bypass]", { budget: facts.budget, category: facts.category, mode: current.mode, stage: current.stage });

    // Synthesize query when music context exists
    if (facts.musicDescription) {
      const category = facts.category === 'headphone' ? 'headphones' : (facts.category === 'speaker' ? 'speakers' : facts.category);
      const musicPart = facts.musicDescription.replace(/^i\s+(listen\s+to|like|love|enjoy)\s+/i, '');
      const budgetPart = facts.budget ? ` under ${facts.budget.replace(/^under\s*/i, '')}` : '';
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
            acknowledge: interpretSymptom(text),
            question: 'What components are you using? Knowing the chain will help pinpoint where this is coming from.',
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
        const budgetQuestion = facts.fromScratch
          ? "What's your budget?"
          : "What's your budget? And do you have an existing system these need to work with?";
        return {
          state: { mode: 'shopping', stage: 'clarify_budget', facts },
          response: {
            kind: 'question',
            acknowledge: categoryAcknowledge(facts.category),
            question: budgetQuestion,
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
      // ── Explicit shopping exit (any stage) ──
      // When the user clearly switches to shopping ("best DAC under $1000"),
      // exit diagnosis cleanly rather than staying stuck.
      if (context.detectedIntent === 'shopping') {
        const shoppingFacts: ConvFacts = { category: newCategory, budget: newBudget, preference: newPreference };
        if (isReadyToRecommend(shoppingFacts)) {
          return { state: { mode: 'shopping', stage: 'ready_to_recommend', facts: shoppingFacts }, response: { kind: 'proceed' } };
        }
        if (shoppingFacts.category) {
          return {
            state: { mode: 'shopping', stage: 'clarify_budget', facts: shoppingFacts },
            response: { kind: 'question', acknowledge: 'Got it — switching to shopping.', question: "What's your budget?" },
          };
        }
        return {
          state: { mode: 'shopping', stage: 'clarify_category', facts: shoppingFacts },
          response: { kind: 'question', acknowledge: 'Got it.', question: 'What are you looking for? Speakers, headphones, a DAC, an amplifier, or a turntable?' },
        };
      }

      if (current.stage === 'clarify_system') {
        // User provided system details — or couldn't. Either way, proceed.
        // System info enriches diagnosis but never gates it.
        facts.hasSystem = facts.hasSystem || context.subjectCount > 0;
        // Check if the user elaborated on their symptom instead of naming components.
        if (hasSymptomKeyword(text)) {
          facts.symptom = text;
        }
        return {
          state: { mode: 'diagnosis', stage: 'ready_to_diagnose', facts },
          response: { kind: 'proceed' },
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
            acknowledge: interpretSymptom(text),
            question: 'What components are you using? Knowing the chain will help pinpoint where this is coming from.',
          },
        };
      }

      // ── Follow-up turns after diagnosis has run ──
      // User might ask remedy questions ("maybe a tube dac?"), elaborate
      // on symptoms, or provide additional system context. Stay in
      // diagnosis mode and re-proceed so the pipeline can use full context.
      if (current.stage === 'ready_to_diagnose') {
        // Note: explicit shopping exit is handled above (detectedIntent === 'shopping').

        // Update symptom if the follow-up contains diagnosis language
        if (hasExplicitDiagnosisSignal(text)) {
          facts.symptom = text;
        }

        // Absorb additional component names
        if (context.subjectCount > 0) {
          facts.hasSystem = true;
        }

        return {
          state: { mode: 'diagnosis', stage: 'ready_to_diagnose', facts },
          response: { kind: 'proceed' },
        };
      }

      // Ready (from other stages)
      if (isReadyToDiagnose(facts)) {
        return {
          state: { mode: 'diagnosis', stage: 'ready_to_diagnose', facts },
          response: { kind: 'proceed' },
        };
      }

      // Fallback — acknowledge any symptom context before asking for system
      return {
        state: { mode: 'diagnosis', stage: 'clarify_system', facts },
        response: {
          kind: 'question',
          acknowledge: facts.symptom ? interpretSymptom(facts.symptom) : 'Got it.',
          question: 'What components are you using? Knowing the chain will help pinpoint where this is coming from.',
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

        // If fromScratch is already known, skip the ownership question
        // and go straight to budget.
        if (facts.fromScratch) {
          const categoryLabel = facts.listeningPath === 'headphones' ? 'headphones' : 'a speaker setup';
          return {
            state: { mode: 'shopping', stage: 'clarify_budget', facts },
            response: {
              kind: 'question',
              acknowledge: `Great — let's find ${categoryLabel} for that kind of listening.`,
              question: "What's your budget?",
            },
          };
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

        // fromScratch is now detected globally at the top of transition(),
        // so no need to check again here.

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

    // ── SYSTEM ASSESSMENT (system entry + assembly) ─────
    case 'system_assessment': {
      if (current.stage === 'entry') {
        facts.hasSystem = true;

        // Check if user provided component descriptions alongside the request
        const hasComponents = hasComponentDescription(text) && context.subjectCount > 0;

        if (hasComponents) {
          // User described components — start assembling
          facts.systemComponents = [text];
          facts.systemAssessmentText = text;

          if (hasExplicitEvaluationLanguage(text)) {
            // e.g. "evaluate my system: JOB integrated and WLM Diva"
            return {
              state: { mode: 'system_assessment', stage: 'ready_to_assess', facts },
              response: { kind: 'proceed' },
            };
          }

          const missing = getMissingRoles(text);
          if (missing.length === 0 || context.subjectCount >= 2) {
            return {
              state: { mode: 'system_assessment', stage: 'ready_to_assess', facts },
              response: { kind: 'proceed' },
            };
          }
          return {
            state: { mode: 'system_assessment', stage: 'assembling_system', facts },
            response: {
              kind: 'question',
              acknowledge: 'Got it — building the picture.',
              question: `What about the ${missing.join(' and ')}?`,
            },
          };
        }

        // Evaluation language but NO components — ask for the system first
        if (hasExplicitEvaluationLanguage(text)) {
          return {
            state: { mode: 'system_assessment', stage: 'assembling_system', facts },
            response: {
              kind: 'question',
              acknowledge: 'Happy to help with that.',
              question: 'What components are in your system?',
            },
          };
        }

        // No evaluation intent and no components — ask what they want to do
        return {
          state: { mode: 'system_assessment', stage: 'clarify_preference', facts },
          response: {
            kind: 'question',
            acknowledge: 'Got it — that\'s your system.',
            question: 'What are you trying to improve or change about it?',
          },
        };
      }

      // ── Assembling system: user is adding components turn by turn ──
      if (current.stage === 'assembling_system') {
        // Accumulate new component text
        const priorComponents = facts.systemComponents ?? [];
        facts.systemComponents = [...priorComponents, text];
        facts.systemAssessmentText = (facts.systemAssessmentText ? facts.systemAssessmentText + '\n' : '') + text;
        facts.hasSystem = true;

        // Check if user explicitly asked for evaluation now
        if (hasExplicitEvaluationLanguage(text)) {
          return {
            state: { mode: 'system_assessment', stage: 'ready_to_assess', facts },
            response: { kind: 'proceed' },
          };
        }

        // Check how complete the system is (using ALL accumulated text)
        const allText = facts.systemAssessmentText;
        const missing = getMissingRoles(allText);

        // If enough context (≤1 missing role or ≥2 subjects), proceed to assessment
        if (missing.length <= 1 || context.subjectCount >= 1) {
          return {
            state: { mode: 'system_assessment', stage: 'ready_to_assess', facts },
            response: { kind: 'proceed' },
          };
        }

        // Still missing major roles — ask for them
        return {
          state: { mode: 'system_assessment', stage: 'assembling_system', facts },
          response: {
            kind: 'question',
            acknowledge: 'Got it.',
            question: `What about the ${missing.join(' and ')}?`,
          },
        };
      }

      // ── Ready to assess: user adds more components or clarifies ──
      if (current.stage === 'ready_to_assess') {
        // User is adding/clarifying components after assessment already ran.
        // Accumulate and re-assess.
        const priorComponents = facts.systemComponents ?? [];
        facts.systemComponents = [...priorComponents, text];
        facts.systemAssessmentText = (facts.systemAssessmentText ? facts.systemAssessmentText + '\n' : '') + text;

        // Check for explicit mode changes
        const wantsBuy = /\b(?:buy|new|shop|looking\s+for|get\s+(?:a|some)|upgrade|replace|add)\b/i.test(text);
        const wantsDiagnose = /\b(?:sounds?\s+(?:off|bad|wrong|thin|bright|muddy|harsh)|problem|issue|something.*off|fatiguing|lacking)\b/i.test(text);

        if (wantsDiagnose) {
          facts.symptom = text;
          return {
            state: { mode: 'diagnosis', stage: 'ready_to_diagnose', facts },
            response: { kind: 'proceed' },
          };
        }

        if (wantsBuy) {
          if (facts.category && facts.budget) {
            return {
              state: { mode: 'shopping', stage: 'ready_to_recommend', facts },
              response: { kind: 'proceed' },
            };
          }
          return {
            state: { mode: 'shopping', stage: facts.category ? 'clarify_budget' : 'clarify_category', facts },
            response: {
              kind: 'question',
              acknowledge: 'Got it — let\'s find the right upgrade.',
              question: facts.category ? "What's your budget?" : 'What component are you looking to change?',
            },
          };
        }

        // Component description or reinforcement → stay in assessment and re-run
        if (hasComponentDescription(text) || context.subjectCount > 0) {
          return {
            state: { mode: 'system_assessment', stage: 'ready_to_assess', facts },
            response: { kind: 'proceed' },
          };
        }

        // General follow-up — still in assessment context
        return {
          state: { mode: 'system_assessment', stage: 'ready_to_assess', facts },
          response: { kind: 'proceed' },
        };
      }

      if (current.stage === 'clarify_preference') {
        // User told us what they want to improve — check what kind of response.
        // FIRST: check if user is providing component descriptions instead of a preference.
        // This happens when "evaluate my system" triggers the question "What are you trying
        // to improve?" and the user responds with component names.
        if (hasComponentDescription(text) || context.subjectCount > 0) {
          facts.systemComponents = [text];
          facts.systemAssessmentText = text;
          facts.hasSystem = true;
          const missing = getMissingRoles(text);
          if (missing.length <= 1 || context.subjectCount >= 2) {
            return {
              state: { mode: 'system_assessment', stage: 'ready_to_assess', facts },
              response: { kind: 'proceed' },
            };
          }
          return {
            state: { mode: 'system_assessment', stage: 'assembling_system', facts },
            response: {
              kind: 'question',
              acknowledge: 'Got it — building the picture.',
              question: `What about the ${missing.join(' and ')}?`,
            },
          };
        }

        const wantsDiagnose = /\b(?:sounds?\s+(?:off|bad|wrong|thin|bright|muddy|harsh)|problem|issue|something.*off|fatiguing|lacking)\b/i.test(text);
        const wantsEvaluation = hasExplicitEvaluationLanguage(text);
        const wantsBuy = /\b(?:buy|new|shop|looking\s+for|get\s+(?:a|some)|upgrade|replace|add)\b/i.test(text);

        if (wantsDiagnose) {
          facts.symptom = text;
          return {
            state: { mode: 'diagnosis', stage: 'ready_to_diagnose', facts },
            response: { kind: 'proceed' },
          };
        }

        if (wantsEvaluation) {
          return {
            state: { mode: 'system_assessment', stage: 'ready_to_assess', facts },
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

  // Detect "from scratch" / "starting fresh" signals on the first turn too
  if (FROM_SCRATCH_PATTERN.test(text)) {
    facts.fromScratch = true;
  }

  console.log("[DEBUG ROUTER]", { category: facts.category, budget: facts.budget });

  // Rule 3: Beginner uncertainty → orientation
  if (isOrientationInput(text)) {
    return { mode: 'orientation', stage: 'entry', facts };
  }

  // Rule 3b: Budget + category → shopping (deterministic, any intent).
  // "Van Halen $5k speakers" has budget + category + preference — go straight
  // to shopping regardless of what the intent detector classified it as.
  if (facts.budget && facts.category && facts.category !== 'general') {
    console.log('[onboarding-skip] budget+category fast-tracked to shopping (category=%s, budget=%s)', facts.category, facts.budget);
    if (facts.preference) facts.musicDescription = text;
    if (isReadyToRecommend(facts)) {
      return { mode: 'shopping', stage: 'ready_to_recommend', facts };
    }
    return { mode: 'shopping', stage: 'ready_to_recommend', facts };
  }

  // Rule 3c: Brand/product + budget → shopping (no category required).
  // "denafrips under 1000" or "denafrips ares under 1000" — the user named
  // a recognized brand or product AND stated a budget. That's a shopping
  // query even without an explicit category keyword. The shopping pipeline
  // will ask for category if needed, or the brand constraint will guide
  // product selection once category is clarified.
  if (facts.budget && context.subjectCount >= 1) {
    console.log('[brand+budget] recognized brand/product + budget → shopping (subjects=%d, budget=%s)', context.subjectCount, facts.budget);
    return { mode: 'shopping', stage: 'clarify_category', facts };
  }

  // Music input — fast-track to shopping when enough signal is present.
  // If the user provides music + budget (+ optional room/category), skip the
  // onboarding question flow and go straight to shopping. Default category
  // to "speaker" when not explicitly stated, since speakers are the most
  // common first purchase.
  if (context.detectedIntent === 'music_input') {
    facts.musicDescription = text;
    const hasRoom = /\b(?:large|small|medium|big|tiny|apartment|bedroom|living\s*room|studio|office|den|loft|open\s*plan|nearfield|near[- ]?field|desktop)\b/i.test(text);
    const hasBudget = !!facts.budget;
    const hasCategory = !!facts.category && facts.category !== 'general';
    // Count signals: music (always true here), budget, room, category
    const signalCount = [true, hasBudget, hasRoom, hasCategory].filter(Boolean).length;
    if (signalCount >= 2) {
      // Enough signal — skip onboarding, go straight to shopping
      if (!hasCategory) facts.category = 'speaker'; // default
      console.log('[onboarding-skip] music_input fast-tracked to shopping (signals=%d, category=%s, budget=%s)', signalCount, facts.category, facts.budget);
      if (isReadyToRecommend(facts)) {
        return { mode: 'shopping', stage: 'ready_to_recommend', facts };
      }
      return { mode: 'shopping', stage: hasBudget ? 'clarify_category' : 'clarify_budget', facts };
    }
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
    // Symptom alone is sufficient to diagnose — system info enriches but
    // never gates. Proceed directly to ready_to_diagnose.
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
    const hasExplicitPurchase = /\b(?:buy|purchase|shop\s+for|shopping\s+for|pick\s+up|recommend|suggest|need\s+(?:a|an)\b|need\s+(?:a\s+)?(?:better|new|good|decent))\b/i.test(text);
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
  // their system, skip clarification and go straight to assessment.
  if (context.detectedIntent === 'system_assessment') {
    facts.hasSystem = true;
    facts.systemAssessmentText = text;
    facts.systemComponents = [text];
    if (hasExplicitEvaluationLanguage(text)) {
      return { mode: 'system_assessment', stage: 'ready_to_assess', facts };
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
