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

// Single money authority (D2, 2026-08-11): the clarify_budget answer path
// must accept everything the shopping pipeline itself accepts ("3k",
// "make it 3k", "two grand"), or the budget question loops. First module
// import here by design — money recognition must not be duplicated.
import { parseBudgetAmount } from './shopping-intent';
import { TURN_SEPARATOR } from './labelled-components';

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
  /**
   * Sticky domain context (Phase K — conversation continuity).
   * Once a category is established in any turn (shopping or diagnosis),
   * it is mirrored here and persists across intent transitions. The
   * orchestrator passes this as `fallbackCategory` so a turn like
   * "it's noisy" after "recommend a turntable" stays in the turntable
   * domain instead of drifting to streamer / DAC / general.
   * Cleared only by an explicit, mismatched override.
   */
  domainContext?: string;
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
  /**
   * Armed for exactly one turn: the first follow-up after an assessment
   * that asks for upgrade direction ("what would I upgrade first?",
   * "weakest link?"). The orchestrator consumes it and answers from the
   * existing assessment instead of re-asking for the system.
   */
  assessmentFollowUpTurn?: boolean;
  /** The standing system review's paragraphs, for follow-up answers. Written
   *  where the review is composed; read by the follow-up net. Lives here —
   *  not in a module store — because this ref provably survives every turn. */
  lastSystemReview?: string[];
  /** Set once the single continuity turn has been used. */
  assessmentContinuityUsed?: boolean;
  /**
   * Temporary / hypothetical chain named by the user in the current thread.
   * Takes precedence over the saved system for shopping, fit, and
   * compatibility reasoning as long as the thread does not explicitly
   * change topic. Populated by the orchestrator when
   * detectHypotheticalChain returns a non-null chain. The UI may still
   * display the saved system — this field only governs recommendation
   * logic.
   *
   * See: hypothetical-system.ts, Pass 15.
   */
  hypotheticalChain?: {
    /** Brand+name strings forming the hypothetical chain. */
    componentNames: string[];
    /** True when the chain contains an external amplifier. */
    hasExternalAmplification: boolean;
    /** Captured on first detection; used to scope lifetime to the thread. */
    detectedAt: number;
  };

  // ── Refinement state (Prompt 3 — follow-up intelligence) ──
  /** Names of products shown in the most recent recommendation set. */
  priorProductNames?: string[];
  /** Category from the prior recommendation (preserved across refinement turns). */
  priorCategory?: string;
  /** Budget from the prior recommendation (preserved across refinement turns). */
  priorBudget?: string;
  /** Accumulated preference deltas from refinement turns (e.g., ['warmer', 'more detailed']). */
  preferenceDeltas?: string[];
  /** True when the current turn is a refinement of prior recommendations. */
  isRefinement?: boolean;
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
  | { kind: 'proceed'; synthesizedQuery?: string }
  | { kind: 'refine'; deltaExplanation: string; preferenceDeltas: string[] };

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
  // Single money authority first (D2 residual, 2026-08-11): the entry
  // pattern below misses revision phrasings ("actually make it 3k"), so
  // a budget change on a shopping re-entry turn re-asked the budget the
  // user had just stated. The anchored pattern remains as fallback for
  // range shapes parseBudgetAmount rejects.
  const parsed = parseBudgetAmount(text);
  if (parsed !== null) return `$${parsed}`;

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
  [/\b(?:dac|d\/a|digital.to.analog)\b/i, 'dac'],
  [/\b(?:amp|amplifier|integrated|receiver)\b/i, 'amplifier'],
  [/\b(?:speaker|speakers|monitor|monitors|bookshelf|floorstander|tower)\b/i, 'speaker'],
  [/\b(?:headphone|headphones|cans|iems?|earbuds?|over.ear|on.ear)\b/i, 'headphone'],
  [/\b(?:turntable|vinyl|record\s+player|phono)\b/i, 'turntable'],
  [/\b(?:streamer|streaming|network\s+player)\b/i, 'streamer'],
  // "stereo", "system", "setup", "hi-fi" → speaker (system anchor).
  // The shopping pipeline treats speaker + build-a-system mode as a full system request.
  [/\b(?:stereo|hi-?fi|hifi|audio\s+system)\b/i, 'speaker'],
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

// ── Refinement detection (Prompt 3 — follow-up intelligence) ──

/** Preference-shift phrases that indicate refinement of prior recommendations. */
const REFINEMENT_PATTERNS: Array<{ pattern: RegExp; delta: string }> = [
  // Warmth axis
  { pattern: /\b(?:make\s+it\s+)?warmer\b/i, delta: 'warmer' },
  { pattern: /\bmore\s+warmth\b/i, delta: 'warmer' },
  { pattern: /\bless\s+bright\b/i, delta: 'warmer' },
  { pattern: /\btoo\s+bright\b/i, delta: 'warmer' },
  { pattern: /\bmore\s+body\b/i, delta: 'warmer' },
  { pattern: /\bmore\s+lush\b/i, delta: 'warmer' },
  { pattern: /\bricher\b/i, delta: 'warmer' },
  // Brightness / detail axis
  { pattern: /\b(?:make\s+it\s+)?brighter\b/i, delta: 'brighter' },
  { pattern: /\bmore\s+detail(?:ed)?\b/i, delta: 'more_detailed' },
  { pattern: /\bmore\s+transparent\b/i, delta: 'more_detailed' },
  { pattern: /\bmore\s+resolving\b/i, delta: 'more_detailed' },
  { pattern: /\bmore\s+analytical\b/i, delta: 'more_detailed' },
  { pattern: /\bmore\s+clarity\b/i, delta: 'more_detailed' },
  { pattern: /\bcleaner\b/i, delta: 'more_detailed' },
  // Smoothness axis
  { pattern: /\bsmoother\b/i, delta: 'smoother' },
  { pattern: /\bless\s+(?:harsh|aggressive|fatiguing)\b/i, delta: 'smoother' },
  { pattern: /\bmore\s+relaxed\b/i, delta: 'smoother' },
  { pattern: /\bmore\s+forgiving\b/i, delta: 'smoother' },
  // Energy / punch axis
  { pattern: /\bmore\s+punch(?:y|ier)?\b/i, delta: 'punchier' },
  { pattern: /\bmore\s+energy\b/i, delta: 'punchier' },
  { pattern: /\bmore\s+dynamic\b/i, delta: 'punchier' },
  { pattern: /\bmore\s+impact\b/i, delta: 'punchier' },
  // Spaciousness axis
  { pattern: /\bmore\s+spacious\b/i, delta: 'more_spacious' },
  { pattern: /\bwider\s+soundstage\b/i, delta: 'more_spacious' },
  { pattern: /\bmore\s+air(?:y|ier)?\b/i, delta: 'more_spacious' },
  // System fit
  { pattern: /\bbetter\s+(?:for|with)\s+my\s+system\b/i, delta: 'system_fit' },
  { pattern: /\bfit\s+my\s+system\b/i, delta: 'system_fit' },
  // General refinement signals
  { pattern: /\bless\s+expensive\b/i, delta: 'cheaper' },
  { pattern: /\bcheaper\b/i, delta: 'cheaper' },
  { pattern: /\bmore\s+expensive\b/i, delta: 'pricier' },
  { pattern: /\bhigher\s+end\b/i, delta: 'pricier' },
];

/**
 * Detect whether a message is a refinement of prior recommendations.
 * Returns the matched deltas, or empty array if not a refinement.
 */
export function detectRefinement(text: string): string[] {
  const deltas: string[] = [];
  for (const { pattern, delta } of REFINEMENT_PATTERNS) {
    if (pattern.test(text) && !deltas.includes(delta)) {
      deltas.push(delta);
    }
  }
  return deltas;
}

/** Human-readable delta explanations for each refinement direction. */
const DELTA_EXPLANATIONS: Record<string, string> = {
  warmer: 'Prioritizing tonal density and body over speed.',
  brighter: 'Prioritizing presence and air over warmth.',
  more_detailed: 'Prioritizing transparency and micro-detail.',
  smoother: 'Prioritizing ease and fatigue resistance over edge.',
  punchier: 'Prioritizing impact and transient energy.',
  more_spacious: 'Prioritizing soundstage width and air.',
  system_fit: 'Re-ranking for system synergy.',
  cheaper: 'Same direction, lower price tier.',
  pricier: 'Same direction, higher build and refinement.',
};

/** Build a one-line delta explanation from accumulated deltas. */
export function buildDeltaExplanation(deltas: string[]): string {
  if (deltas.length === 0) return '';
  if (deltas.length === 1) return DELTA_EXPLANATIONS[deltas[0]] ?? '';
  // Combine multiple: take the first two
  const parts = deltas.slice(0, 2).map(d => DELTA_EXPLANATIONS[d] ?? d).filter(Boolean);
  return parts.join(' ');
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
  /\bsomething\s+(?:(?:is|sounds?|feels?)\s+)?(?:off|wrong|missing)\b/i,
  /\b(?:problem|issue)\s+with\b/i,
  // Causal-hypothesis pivot (M5-F8, 2026-08-11): "could my amp be
  // causing the brightness?" mid-shopping must release the shopping
  // state — without this signal, isIntentMismatch never fired and the
  // done-stage refinement classifier consumed the pivot as a
  // preference delta, re-rendering shopping cards.
  /\b(?:could|might|can)\s+(?:my|the)\s+[\w\s-]{2,24}?\bbe\s+(?:causing|behind|responsible\s+for)\b/i,
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

/**
 * Conservative purchase-intent check used to gate continuation-state
 * exits out of diagnosis (and, by future symmetry, other modes) into
 * shopping. The detector layer (`detectIntent`) treats short refinement
 * phrases like "warmer" as shopping intent without any awareness of
 * conversation context — that is correct for stateless detection but
 * wrong when the user is mid-diagnosis and the message is a remedy
 * hypothesis ("what about a warmer source?").
 *
 * Returning true here requires an explicit purchase, search, budget, or
 * "best <category>" signal in the text. Quality-only refinement vocabulary
 * (warmer / brighter / more body / etc.) is deliberately NOT a signal.
 *
 * This helper is intentionally narrow: false negatives keep the user in
 * the current mode (safe — diagnosis follow-up still routes correctly);
 * false positives would exit diagnosis on a remedy hypothesis (the bug
 * this guards against).
 */
const PURCHASE_INTENT_PATTERNS: RegExp[] = [
  // Explicit purchase verbs
  /\b(?:buy|buying|bought|purchase|purchasing)\b/i,
  // Active search framings
  /\bshop(?:ping)?\s+for\b/i,
  /\blooking\s+for\b/i,
  // Recommendation / suggestion requests
  /\brecommend(?:ation)?s?\b/i,
  /\bsuggest(?:ion)?s?\b/i,
  // Budget signals
  /\bbudget\b/i,
  /\bunder\s+\$?\d/i,
  /\$\s?\d/,
  // "best <category>" framing
  /\bbest\s+(?:dac|amp(?:lifier)?|speakers?|headphones?|turntables?|streamers?|integrated|preamp)\b/i,
];

function hasExplicitPurchaseIntent(text: string): boolean {
  return PURCHASE_INTENT_PATTERNS.some((p) => p.test(text));
}

// ── Symptom interpretation ──────────────────────────────
// Maps common symptom keywords to brief architectural interpretations.
// Used to acknowledge symptoms intelligently before asking for system details.

const SYMPTOM_INTERPRETATIONS: Array<[RegExp, string]> = [
  [/\bthin\b/i, 'Thin points to tonal balance — lightweight bass, lean midrange, or source-amplification mismatch.'],
  [/\bdry\b/i, 'Dry points to stripped harmonics — high-feedback amplification, analytical sources, or aggressive room treatment.'],
  [/\bbright\b.*\bfatigu/i, 'Brightness with fatigue traces to compounded upper-frequency energy — source, amp, and speakers all pushing the same way.'],
  [/\bfatigu/i, 'Fatigue points to excess upper-midrange energy, poor damping interaction, or compounded brightness in the chain.'],
  [/\bbright\b/i, 'Brightness comes from upper-frequency concentration, often compounded across multiple components.'],
  [/\bharsh\b/i, 'Harshness originates from upper-midrange distortion or resonance — clipping, crossover artifacts, or room reflections.'],
  [/\bmuddy\b/i, 'Muddiness means excess low-mid energy or poor bass control — room modes, underdamped speakers, or stacked warmth.'],
  [/\bdull\b/i, 'Dull or lifeless sound comes from over-smoothing — excess warmth, heavy damping, or detail lost upstream.'],
  [/\bveiled\b/i, 'Veiled sound traces to something masking fine detail — cable losses, warm DAC compounding a warm amp, or driver limits.'],
  [/\bcongested\b/i, 'Congestion points to compressed spatial and dynamic information — insufficient headroom, room overload, or stacked warmth.'],
  [/\bsibilan/i, 'Sibilance comes from a presence-region peak — tweeter behavior, crossover alignment, or transient over-emphasis upstream.'],
  [/\bsterile\b|\bclinical\b|\bcold\b/i, 'Sterile or clinical sound means the system prioritizes precision over musicality — high feedback, no warmth offset.'],
  [/\bflat\b|\bboring\b|\blifeless\b/i, 'Lifeless presentation means the system is over-controlled — dynamic compression, heavy damping, or smoothed-out musical energy.'],
  [/\blacking\b|\bmissing\b/i, 'That sense of something missing comes from a voicing gap — knowing the components identifies where the loss originates.'],
  [/\baggressive\b|\bforward\b|\bstrident\b/i, 'Aggressive or forward sound traces to upper-midrange emphasis — speaker directivity, amplifier voicing, or room reflections.'],
];

/**
 * Produces a brief architectural interpretation of the symptom described in the
 * user's text. Returns a generic fallback if no specific pattern matches.
 */
export function interpretSymptom(text: string): string {
  for (const [pattern, interpretation] of SYMPTOM_INTERPRETATIONS) {
    if (pattern.test(text)) return interpretation;
  }
  return 'That traces to a specific chain interaction — tonal balance, damping, or component voicing.';
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

// Direction-seeking follow-up after an assessment: asks WHICH move to make
// without naming a replacement product. Kept narrow — explicit buying
// intent ("I want to buy a new DAC") must still exit to shopping.
// Verdict challenges (Mission 4B, 2026-08-10): "are you sure?" after a
// no-change assessment routed to the knowledge lane and answered with a
// generic meta-essay about how the advisor works, never re-engaging the
// verdict or the system's evidence. A challenge to the verdict is an
// assessment follow-up — it must be answered FROM the assessment.
const ASSESSMENT_VERDICT_CHALLENGE =
  /\bare\s+you\s+sure\b|\bhow\s+do\s+you\s+know\b|\bwhat\s+makes\s+you\s+say\b|\bwhy\s+do\s+you\s+say\b|\bconvince\s+me\b|\bjustify\b|\bprove\s+it\b|^\s*(?:why|really)\s*\??\s*$/i;

/**
 * Opinion questions about NAMED gear — "what do you think of Goldmund
 * amps?", "thoughts on the Boenicke W8", "tell me about Shindo".
 *
 * Beta observation 2026-08-10 (founder, production): asked mid-assessment,
 * these were absorbed by the `ready_to_assess` accumulate-and-re-assess
 * branch below — the question text was appended to the stored system
 * description and the turn was answered with another assessment of the
 * saved system. A question about a brand the user does not own is a topic
 * change, not a component clarification.
 *
 * Deliberately narrower than intent.ts's PRODUCT_ASSESSMENT_PATTERNS:
 * only unambiguous opinion phrasings break the assessment out. Shapes
 * like "what about the …" stay with accumulation, where they usually are
 * a clarification of the system under review. Kept local so this module
 * stays free of imports — see intent.ts `isSystemDirectedEvaluation` for
 * the same rule applied at the intent layer.
 */
const GEAR_OPINION_QUESTION = /\bwhat\s+do\s+you\s+think\s+(?:of|about)\b|\bthoughts\s+on\b|\bopinions?\s+on\b|\btell\s+me\s+about\b|\bknow\s+anything\s+about\b|\bany\s+experience\s+with\b|\bhave\s+you\s+heard\s+(?:of|about)\b|\bwhat\s+do\s+you\s+(?:know|have)\s+(?:about|on)\b/i;

/** System referents — when present the question is about the system. */
const SYSTEM_REFERENT = /\b(?:system|setup|rig|chain)\b|\bwhat\s+do\s+you\s+think\s+(?:of|about)\s+(?:it|this|that|these|them)\b/i;

const ASSESSMENT_DIRECTION_FOLLOWUP = new RegExp(
  /\b(?:what|which|where)\b[^.?!]{0,60}\b(?:upgrade|improve|change|replace|swap\s+out|spend)\b|\bupgrade\s+(?:just\s+)?(?:one\s+thing|first|next|anything)\b|\b(?:change|improve)\s+(?:just\s+)?one\s+thing\b|\bweak(?:est)?\s+(?:link|point|spot)\b|\bholding\s+(?:it|things|everything|(?:my|the|this|our)\s+system|(?:the\s+)?\w+(?:\s+\w+)?)\s+back\b|\bbiggest\s+(?:improvement|impact|difference)\b|\bfirst\s+upgrade\b|\bupgrade\s+path\b|\bshould\s+i\s+(?:upgrade|replace|change)\s+(?:first|next|anything)\b/.source
  + '|' + ASSESSMENT_VERDICT_CHALLENGE.source,
  'i',
);

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

  // Continuation-state guard: when the user is mid-diagnosis and
  // `detectIntent` flags a single refinement token ("warmer", "more body")
  // as shopping intent, that is NOT a mode pivot — it's a remedy
  // hypothesis. Require explicit purchase / search / budget evidence in
  // the text before treating shopping as a real mismatch. Without this
  // gate, the upstream reset at the top of transition() short-circuits
  // before the in-case diagnosis→shopping exit branch can apply the
  // same check.
  if (mode === 'diagnosis' && detectedIntent === 'shopping') {
    if (!text || !hasExplicitPurchaseIntent(text)) return false;
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
    /**
     * Optional synthetic system description sourced from the new
     * SavedSystemProfile store (Step 3 of the saved-system bridge).
     * When present, the system_assessment entry path uses this text
     * instead of asking the user to list components.
     */
    injectedSystemText?: string;
  },
): ConvTransition {
  // ── Intent-change detection ────────────────────────────
  // When the user's new intent is clearly incompatible with the
  // active conversation mode, reset to idle with fresh facts.
  // This prevents stale category/budget/system data from leaking
  // across unrelated flows (e.g. DAC shopping → KEF vs ELAC comparison).
  if (context.detectedIntent && isIntentMismatch(current.mode, context.detectedIntent, text)) {
    const freshMode = detectInitialMode(text, {
      detectedIntent: context.detectedIntent,
      hasSystem: context.hasSystem,
      subjectCount: context.subjectCount,
      injectedSystemText: context.injectedSystemText,
    });
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

  // ── Refinement intercept (Prompt 3) ──────────────────
  // When prior recommendations exist and the user sends a preference-shift
  // message, re-enter ready_to_recommend with the delta applied.
  // This fires BEFORE the onboarding bypass to prevent state reset.
  if (facts.priorProductNames && facts.priorProductNames.length > 0) {
    const deltas = detectRefinement(text);
    if (deltas.length > 0) {
      // "better for my system" guard: if no system known, ask one question
      if (deltas.includes('system_fit') && !facts.hasSystem && !context.hasSystem) {
        return {
          state: { mode: 'shopping', stage: 'ready_to_recommend', facts: { ...facts, isRefinement: false } },
          response: {
            kind: 'question',
            acknowledge: 'I can tailor these to your system.',
            question: 'What components are in your current system? (e.g., DAC, amp, speakers)',
          },
        };
      }

      // Accumulate deltas
      const existingDeltas = facts.preferenceDeltas ?? [];
      const mergedDeltas = [...existingDeltas];
      for (const d of deltas) {
        if (!mergedDeltas.includes(d)) mergedDeltas.push(d);
      }

      // Restore category/budget from prior recommendation context
      if (!facts.category && facts.priorCategory) facts.category = facts.priorCategory;
      if (!facts.budget && facts.priorBudget) facts.budget = facts.priorBudget;

      facts.preferenceDeltas = mergedDeltas;
      facts.isRefinement = true;

      const explanation = buildDeltaExplanation(deltas);
      console.log('[refinement]', { deltas, mergedDeltas, explanation, priorProducts: facts.priorProductNames });

      return {
        state: { mode: 'shopping', stage: 'ready_to_recommend', facts },
        response: { kind: 'refine', deltaExplanation: explanation, preferenceDeltas: mergedDeltas },
      };
    }
  }

  // Phase K — sticky domain continuity.
  // Mirror category into domainContext so it survives turns that don't
  // re-state a category keyword. The orchestrator reads facts.domainContext
  // (or falls back to facts.category) when calling detectShoppingIntent so
  // that "it's noisy" after "recommend a turntable" stays in the turntable
  // domain. We never overwrite an established domain with `undefined`;
  // explicit category mismatches still clear it via isIntentMismatch above.
  if (facts.category && facts.category !== 'general') {
    facts.domainContext = facts.category;
  }

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

    // Synthesize from category + budget (D2 residual, 2026-08-11) — a
    // bare proceed hands the pipeline the user's raw final reply (e.g.
    // "1500"), dropping the facts the intake just collected. Mirrors the
    // clarify_budget synthesis in the shopping case.
    if (facts.category && facts.budget) {
      const budgetPart = facts.budget.replace(/^under\s*/i, '');
      return {
        state: { mode: 'shopping', stage: 'ready_to_recommend', facts },
        response: {
          kind: 'proceed',
          synthesizedQuery: `Looking for a ${facts.category} under ${budgetPart}.`,
        },
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
      // ── Intent-driven exit ──────────────────────────────
      // When the user provides a clear, actionable message instead of
      // answering the orientation triage question, honour the detected
      // intent and re-enter the state machine fresh.  This avoids
      // maintaining a second, weaker regex for each symptom word.
      //
      // "diagnosis" is excluded from the set because detectIntent uses
      // diagnosis as its default fallback — a bare "buy" or "improve"
      // would trigger an unwanted exit.  Instead, diagnosis exits only
      // when an explicit symptom signal is present.
      const ORIENTATION_EXIT_INTENTS = new Set([
        'shopping', 'comparison', 'system_assessment',
        'product_assessment', 'consultation_entry', 'cable_advisory',
        'educational', 'greeting',
      ]);
      const shouldExitOrientation =
        (context.detectedIntent && ORIENTATION_EXIT_INTENTS.has(context.detectedIntent)) ||
        (context.detectedIntent === 'diagnosis' && hasExplicitDiagnosisSignal(text));

      if (shouldExitOrientation) {
        const freshMode = detectInitialMode(text, {
          detectedIntent: context.detectedIntent!,
          hasSystem: context.hasSystem,
          subjectCount: context.subjectCount,
        });
        return {
          state: freshMode ?? INITIAL_CONV_STATE,
          response: null,
        };
      }

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
      // Delegates to parseBudgetAmount (D2, 2026-08-11) — the local
      // PLAIN_BUDGET_PATTERN required 3+ digits, so "3k" (the canonical
      // budget answer) parsed null and the question looped. The single
      // money authority accepts every phrasing the pipeline accepts;
      // the plain pattern remains as fallback for shapes it rejects.
      if (current.stage === 'clarify_budget' && !facts.budget) {
        const parsed = parseBudgetAmount(text);
        if (parsed !== null) {
          facts.budget = `$${parsed}`;
        } else {
          // Stage-licensed loose scan (M5-F2, 2026-08-11): the budget
          // question was JUST asked, so the stage context is the anchor —
          // "maybe 2k? honestly not sure I even want to spend it" is a
          // budget answer, hedges and all. Any k-token or bare 3-6 digit
          // number in the reply counts here and ONLY here.
          const looseK = text.match(/\b(\d{1,4}(?:\.\d{1,2})?)\s*k\b/i);
          const plainMatch = text.match(PLAIN_BUDGET_PATTERN);
          if (looseK) {
            facts.budget = `$${Math.round(parseFloat(looseK[1]) * 1000)}`;
          } else if (plainMatch) {
            facts.budget = `$${plainMatch[1]}`;
          }
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
        // Facts gathered through the machine's own questions must reach the
        // shopping pipeline. A bare proceed hands the pipeline the user's raw
        // final reply — verified on production: after "which component?" →
        // "the dac" → "what's your budget?" → "1500", the pipeline re-routed
        // the literal text "1500" to the knowledge lane and answered "without
        // a specific question or component type mentioned…", dropping the
        // category and budget the intake had just collected. Synthesize the
        // query from facts, exactly as the music path above already does.
        if (facts.category && facts.budget) {
          const budgetPart = facts.budget.replace(/^under\s*/i, '');
          return {
            state: { mode: 'shopping', stage: 'ready_to_recommend', facts },
            response: {
              kind: 'proceed',
              synthesizedQuery: `Looking for a ${facts.category} under ${budgetPart}.`,
            },
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
        // Have category — now need budget.
        //
        // Never ask about an existing system the advisor already knows.
        // Verified on production: a user whose three-component system had
        // been assessed, echoed and check-marked earlier in the same
        // conversation was asked "do you have an existing system these need
        // to work with?" — the canonical not-listening failure. The caller
        // already passes context.hasSystem (active/saved/injected system);
        // it simply was not consulted here.
        const budgetQuestion = facts.fromScratch || context.hasSystem
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
      //
      // Continuation-state guard: `detectedIntent === 'shopping'` alone is
      // not enough. `detectIntent` returns 'shopping' for short refinement
      // phrases like "warmer" / "more body" — those are remedy hypotheses
      // when the user is mid-diagnosis, not buying intent. Require an
      // explicit purchase/search/budget signal in the text before exiting.
      // See `hasExplicitPurchaseIntent` above for the vocabulary.
      if (context.detectedIntent === 'shopping' && hasExplicitPurchaseIntent(text)) {
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
      // Questions ABOUT the comparison are follow-ups, never comparands
      // (D3, 2026-08-11): "what am I giving up with the harbeth?" during
      // an active pair was consumed as intake ("Got it — one down") —
      // forgetting the established comparison and misreading a
      // consequence question as a component name. Proceed so the
      // pipeline's comparison-continuation answers from the active pair.
      const COMPARISON_QUESTION_NOT_COMPARAND = /\bgiving\s+up\b|\bwhat\s+do\s+i\s+lose\b|\btrade[- ]?offs?\b|\bdownsides?\b|\bwhy\b|\bare\s+you\s+sure\b|\bwhich\s+(?:one|would|should)\b/i;
      if (
        current.stage === 'ready_to_compare'
        && COMPARISON_QUESTION_NOT_COMPARAND.test(text)
      ) {
        return {
          state: { mode: 'comparison', stage: 'ready_to_compare', facts },
          response: { kind: 'proceed' },
        };
      }

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

        // Evaluation language but NO components in text.
        // If a saved system was injected from the SavedSystemProfile store,
        // use it directly and skip the component-ask branch entirely.
        if (hasExplicitEvaluationLanguage(text)) {
          if (context.injectedSystemText && context.injectedSystemText.trim().length > 0) {
            const injected = context.injectedSystemText.trim();
            facts.systemComponents = [injected];
            facts.systemAssessmentText = injected;
            return {
              state: { mode: 'system_assessment', stage: 'ready_to_assess', facts },
              response: { kind: 'proceed' },
            };
          }
          return {
            state: { mode: 'system_assessment', stage: 'assembling_system', facts },
            response: {
              kind: 'question',
              acknowledge: 'Happy to help with that.',
              question: 'What components are in your system?',
            },
          };
        }

        // Advice-first (Product Doctrine v1.0, WS28): rather than asking
        // the user what they want to improve BEFORE offering any opinion,
        // attempt a provisional system assessment from what they've given.
        // buildSystemAssessment forms the observation / interpretation /
        // trade-off / recommendation and appends its own refining
        // follow-up; it falls back to a clarification question only when
        // it genuinely cannot read a system (handled in page.tsx via
        // assessmentResult.kind === 'clarification' | 'low_confidence').
        // This makes the upgrade / change / keep decision prompts return
        // advice on turn one instead of a bare clarifying question.
        facts.systemComponents = [text];
        facts.systemAssessmentText = text;
        return {
          state: { mode: 'system_assessment', stage: 'ready_to_assess', facts },
          response: { kind: 'proceed' },
        };
      }

      // ── Assembling system: user is adding components turn by turn ──
      if (current.stage === 'assembling_system') {
        // Accumulate new component text
        const priorComponents = facts.systemComponents ?? [];
        facts.systemComponents = [...priorComponents, text];
        // Turns are joined with a STRUCTURAL separator, not a newline. A newline is
        // not a turn boundary — one turn contains several — so the parser could not
        // tell where a turn ended and ran a component name into the next turn's
        // opening prose. See TURN_SEPARATOR in labelled-components.ts.
        facts.systemAssessmentText = (facts.systemAssessmentText ? facts.systemAssessmentText + TURN_SEPARATOR : '') + text;
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
        // ── Launch continuity (2026-07-19): first follow-up direction question ──
        // "What would I upgrade first?" / "weakest link?" right after an
        // assessment is answered FROM that assessment, not met with
        // "what component are you looking to change?". Scope is one turn:
        // the flag arms once, the orchestrator consumes it, and later
        // direction questions take the normal clarify path. Questions
        // naming a specific product (subjectCount > 0) keep the existing
        // accumulate-and-reassess behaviour. Checked before accumulation
        // so the question text never pollutes the stored system text.
        /*
         * OWN-COMPONENT SUBSTITUTION QUESTIONS STAY IN THE ASSESSMENT
         * (sparse-evidence pass, 2026-08-27). "Would replacing the Eversolo
         * with a much better external DAC be a worthwhile upgrade?" names a
         * product — the system's OWN product — so subjectCount > 0 pushed it
         * out of continuity and the shopping lane answered a reasoning
         * question with a budget intake. A substitution question about a
         * component of the system just assessed is a direction question
         * about that assessment. A question naming NEW gear keeps the
         * existing compare/shopping behaviour.
         */
        const assessedText = (facts.systemAssessmentText ?? '').toLowerCase();
        // Generic audio vocabulary can overlap any two audio sentences;
        // only a token that names the assessed system's own gear counts.
        const GENERIC = new Set(['system', 'assess', 'assessment', 'amplifier', 'amp',
          'amps', 'speaker', 'speakers', 'streamer', 'preamp', 'monitor', 'monitors',
          'integrated', 'external', 'better', 'would', 'replacing', 'replace',
          'upgrade', 'worthwhile', 'with', 'much', 'that', 'this', 'from', 'into',
          'dac', 'source', 'change', 'swap', 'what', 'the', 'and', 'out']);
        const qTokens = text.toLowerCase().split(/[^a-z0-9+/.-]+/)
          .filter((w) => w.length >= 3 && !GENERIC.has(w));
        const ownTokens = qTokens.filter((w) => assessedText.includes(w));
        // A model-ish token (carries a digit, or a brand-like word of 4+
        // letters the assessed text does not contain, adjacent to a swap
        // verb's object) that names gear OUTSIDE the system keeps the
        // existing compare/accumulate behaviour — proposing new gear is not
        // a direction question about the standing assessment.
        const proposesNamedReplacement = qTokens.some((w) =>
          !assessedText.includes(w) && /\d/.test(w));
        const namesOwnComponentOnly = context.subjectCount > 0 && assessedText.length > 0
          && (/\b(?:replac|swap|upgrad|substitut|instead of)\w*\b/i.test(text)
            || ASSESSMENT_DIRECTION_FOLLOWUP.test(text))
          && ownTokens.length >= 1
          && !proposesNamedReplacement;

        if (
          !facts.assessmentContinuityUsed
          && (context.subjectCount === 0 || namesOwnComponentOnly)
          && (ASSESSMENT_DIRECTION_FOLLOWUP.test(text)
            || (namesOwnComponentOnly && /\bupgrade|worthwhile|worth it|improve\b/i.test(text)))
        ) {
          facts.assessmentContinuityUsed = true;
          facts.assessmentFollowUpTurn = true;
          return {
            state: { mode: 'system_assessment', stage: 'ready_to_assess', facts },
            response: { kind: 'proceed' },
          };
        }

        // ── Named-gear opinion question → leave assessment mode ──
        // "What do you think of Goldmund amps?" after an assessment is a
        // new topic, not a component clarification. Without this the
        // question text was accumulated into `systemAssessmentText` and
        // answered with a re-assessment of the same system. Reset to idle
        // and let the normal pipeline route it (intent.ts §5 brand lane) —
        // the same shape the intent-mismatch escape at the top of
        // transition() uses.
        if (
          context.subjectCount > 0
          && GEAR_OPINION_QUESTION.test(text)
          && !SYSTEM_REFERENT.test(text)
        ) {
          return { state: INITIAL_CONV_STATE, response: null };
        }

        // User is adding/clarifying components after assessment already ran.
        // Accumulate and re-assess.
        const priorComponents = facts.systemComponents ?? [];
        facts.systemComponents = [...priorComponents, text];
        // Turns are joined with a STRUCTURAL separator, not a newline. A newline is
        // not a turn boundary — one turn contains several — so the parser could not
        // tell where a turn ended and ran a component name into the next turn's
        // opening prose. See TURN_SEPARATOR in labelled-components.ts.
        facts.systemAssessmentText = (facts.systemAssessmentText ? facts.systemAssessmentText + TURN_SEPARATOR : '') + text;

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
    injectedSystemText?: string;
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

  // Greeting / educational / no-problem → orientation (never diagnosis)
  if (context.detectedIntent === 'greeting' || context.detectedIntent === 'educational') {
    return { mode: 'orientation', stage: 'entry', facts };
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
    // If they have specifics (category or budget), route to shopping.
    // When category is present (e.g. "I want a DAC", "I want speakers"),
    // go straight to ready_to_recommend with an exploratory set rather
    // than asking for budget first. Budget can be refined in follow-up.
    if (facts.category || facts.budget) {
      if (isReadyToRecommend(facts)) {
        return { mode: 'shopping', stage: 'ready_to_recommend', facts };
      }
      if (facts.category) {
        return { mode: 'shopping', stage: 'ready_to_recommend', facts };
      }
      return { mode: 'shopping', stage: 'clarify_category', facts };
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
    // If a saved system was injected and the user's text has no
    // components of its own, use the injected system as the assessment
    // source. Otherwise preserve existing behavior (text drives it).
    const injected =
      context.injectedSystemText && context.injectedSystemText.trim().length > 0
        ? context.injectedSystemText.trim()
        : null;
    if (injected && !hasComponentDescription(text)) {
      facts.systemAssessmentText = injected;
      facts.systemComponents = [injected];
    } else {
      facts.systemAssessmentText = text;
      facts.systemComponents = [text];
    }
    if (hasExplicitEvaluationLanguage(text) || injected) {
      return { mode: 'system_assessment', stage: 'ready_to_assess', facts };
    }
    return { mode: 'system_assessment', stage: 'entry', facts };
  }

  // Consultation entry — user asks for system guidance without naming gear.
  // If a saved system was injected via the SavedSystemProfile bridge, use it
  // directly and jump to ready_to_assess instead of asking for components.
  // Guard: only inject saved system when the user's text has no component
  // descriptions of its own. Mirrors the system_assessment guard above.
  if (context.detectedIntent === 'consultation_entry') {
    const injectedForConsult =
      context.injectedSystemText && context.injectedSystemText.trim().length > 0
        ? context.injectedSystemText.trim()
        : null;
    if (injectedForConsult && !hasComponentDescription(text)) {
      facts.hasSystem = true;
      facts.systemAssessmentText = injectedForConsult;
      facts.systemComponents = [injectedForConsult];
      return { mode: 'system_assessment', stage: 'ready_to_assess', facts };
    }
    if (hasComponentDescription(text)) {
      // User described components but intent was classified as consultation_entry.
      // Treat as system_assessment with user's own text.
      facts.hasSystem = true;
      facts.systemAssessmentText = text;
      facts.systemComponents = [text];
      return { mode: 'system_assessment', stage: 'ready_to_assess', facts };
    }
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
