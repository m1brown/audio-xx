/**
 * Lightweight clarification layer.
 *
 * Determines whether a follow-up question would meaningfully improve
 * the next evaluation pass. Returns null when the analysis is already
 * actionable or when the conversation has reached its turn cap.
 *
 * Clarifications follow a three-step conversational structure:
 *   1. Acknowledge — mirror what the user said (1–2 sentences)
 *   2. Context — brief neutral observation (optional)
 *   3. Question — the actual follow-up
 *
 * This prevents the system from jumping straight into diagnostic
 * questioning without acknowledging the user's input.
 */
import type { ExtractedSignals } from './signal-types';
import type { EvaluationResult } from './rule-types';
import {
  detectShoppingIntent,
  getShoppingClarification,
  getShoppingTurnCap,
} from './shopping-intent';

// ── Response type ─────────────────────────────────────

export interface ClarificationResponse {
  /** Short acknowledgement of what the user said. */
  acknowledge: string;
  /** Optional neutral observation or context. */
  context?: string;
  /** The clarifying question to ask. */
  question: string;
}

// ── Case 1: Interpretation Ambiguity ──────────────────

interface AmbiguousPhrase {
  /** Phrases (lowercased) that trigger this ambiguity check. */
  triggers: string[];
  /** The clarifying question to surface. */
  question: string;
}

const AMBIGUOUS_PHRASES: AmbiguousPhrase[] = [
  {
    triggers: ['sweet', 'sweetness'],
    question:
      'When you say sweet, are you thinking more about:\n• a richer, golden tone with more body (harmonic warmth)\n• or mainly the absence of harshness and edge (low fatigue)',
  },
  {
    triggers: ['smooth', 'smoothness'],
    question:
      'When you say smooth, do you mean:\n• relaxed and forgiving — easy to listen to for hours (low fatigue)\n• or fluid and continuous — notes flowing into each other (musical flow)',
  },
  {
    triggers: ['detailed', 'detail', 'resolving'],
    question:
      'When you say detailed, are you thinking about:\n• hearing every tiny element in the recording (micro-detail retrieval)\n• or instruments sounding more present and clearly articulated (presence / articulation)',
  },
  {
    triggers: ['warm', 'warmth'],
    question:
      'When you say warm, do you mean:\n• fuller and denser — more weight in the midrange (tonal density)\n• or mainly less bright and less tiring to listen to (reduced treble / low fatigue)',
  },
  {
    triggers: ['open', 'openness', 'airy'],
    question:
      'When you say open, are you thinking about:\n• a wider, more spacious sense of the room and instrument placement (soundstage)\n• or more sparkle and space in the high frequencies (treble extension / air)',
  },
  {
    triggers: ['musical', 'musicality'],
    question:
      'When you say musical, do you mean:\n• strong rhythm and a sense of momentum that draws you in (rhythmic engagement)\n• or beautiful tone and rich harmonics that sound pleasing (tonal beauty)',
  },
  {
    triggers: ['natural', 'organic'],
    question:
      'When you say natural, do you mean:\n• instruments sound like the real thing — accurate tone color (timbral accuracy)\n• or a relaxed, non-mechanical quality — easy and uncontrived (organic ease)',
  },
  {
    triggers: ['fast', 'speed', 'quick'],
    question:
      'When you say fast, are you thinking more about:\n• sharp attacks and crisp note starts (transient attack / leading edges)\n• or a strong sense of rhythm and momentum in the music (pace / rhythmic drive)',
  },
];

function checkInterpretationAmbiguity(
  signals: ExtractedSignals,
  result: EvaluationResult,
): string | null {
  const matchedLower = signals.matched_phrases.map((p) => p.toLowerCase());

  // Only ask about ambiguity when rules fired are generic
  // (fallback, or a broad rule that would benefit from specificity)
  const firedIds = result.fired_rules.map((r) => r.id);
  const isGenericResult =
    firedIds.includes('friendly-advisor-fallback') ||
    result.fired_rules.length <= 1;

  if (!isGenericResult) return null;

  for (const entry of AMBIGUOUS_PHRASES) {
    if (entry.triggers.some((t) => matchedLower.includes(t))) {
      return entry.question;
    }
  }

  return null;
}

// ── Case 2: Diagnostic Uncertainty ────────────────────

function checkDiagnosticUncertainty(
  signals: ExtractedSignals,
  result: EvaluationResult,
): string | null {
  const isFallbackOnly =
    result.fired_rules.length === 1 &&
    result.fired_rules[0].id === 'friendly-advisor-fallback';

  const isLowInformation = signals.matched_phrases.length <= 1;
  const isHighUncertainty = signals.uncertainty_level >= 2;

  if (isFallbackOnly || isLowInformation || isHighUncertainty) {
    return 'Could you describe what specifically bothers or pleases you — is it about how things sound (tone, brightness, warmth), where instruments seem to be (space, width), or how the music moves (timing, rhythm, energy)?';
  }

  return null;
}

// ── Case 3: Shopping Intent ──────────────────────────

function checkShoppingIntent(
  signals: ExtractedSignals,
  userText: string,
  turnCount: number,
): string | null {
  const ctx = detectShoppingIntent(userText, signals);
  if (!ctx.detected) return null;
  return getShoppingClarification(ctx, signals, turnCount);
}

// ── Case 4: Neutral / Opinion Questions ──────────────

/**
 * Detects neutral "what do you think?" or "opinions on X?" questions
 * where the user hasn't stated a problem or preference direction.
 * Instead of jumping to diagnostic questioning, ask about intent.
 */
const NEUTRAL_PATTERNS = [
  /what do you think (?:of|about) /i,
  /thoughts on /i,
  /opinion on /i,
  /opinions on /i,
  /what are your thoughts/i,
  /how (?:do you feel|would you rate) /i,
  /is (?:the|a|an) .+ (?:good|worth|any good)/i,
  /any experience with /i,
  /have you heard /i,
  /know anything about /i,
];

function checkNeutralQuestion(
  signals: ExtractedSignals,
  currentMessage: string,
): string | null {
  const lower = currentMessage.toLowerCase();

  // Only trigger when the user hasn't given strong preference signals
  if (signals.matched_phrases.length >= 2) return null;
  if (signals.symptoms.length >= 1) return null;

  const isNeutral = NEUTRAL_PATTERNS.some((p) => p.test(lower));
  if (!isNeutral) return null;

  return 'Are you thinking about using it in a system, or just curious about its character?';
}

// ── Acknowledgement generation ────────────────────────

/** Category labels for conversational use (lowercase, natural). */
const CATEGORY_NAMES: Record<string, string> = {
  dac: 'DACs',
  amplifier: 'amplifiers',
  speaker: 'speakers',
  headphone: 'headphones',
  streamer: 'streamers',
  turntable: 'turntables',
  general: 'gear',
};

/**
 * Generate a short acknowledgement that reflects what the user
 * actually said. Reads their message for specific topics, terms,
 * and intent so the response feels like a real conversation rather
 * than a form being filled out.
 *
 * Rules:
 *   - Do not assume a problem unless the user stated one.
 *   - Keep to 1–2 sentences.
 *   - Echo specific content (category, comparisons, descriptive terms).
 */
function generateAcknowledge(
  signals: ExtractedSignals,
  currentMessage: string,
  turnCount: number,
  category: string,
): string {
  const lower = currentMessage.toLowerCase();
  const catName = CATEGORY_NAMES[category] ?? 'gear';
  const phrases = signals.matched_phrases;

  // Follow-up turns — brief and varied
  if (turnCount > 1) {
    if (phrases.length >= 2) return 'That paints a clearer picture.';
    if (phrases.length === 1) return 'Got it, that helps.';
    if (lower.includes('budget') || lower.includes('$')) return 'Good to know the budget range.';
    if (lower.includes('my system') || lower.includes('my setup')) return 'Helpful to know the system context.';
    return 'Noted — thanks for that.';
  }

  // First turn — reflect the user's actual topic

  // Opinion or "what do you think" questions — don't assume a problem
  if (lower.includes('what do you think') || lower.includes('thoughts on') || lower.includes('opinion on')) {
    if (category !== 'general') {
      return `Good question about ${catName} — the answer depends a lot on what you\'re pairing them with and what you value in listening.`;
    }
    return 'That depends on a few things — what matters most to you and the rest of the system.';
  }

  // Comparisons — name the comparison
  if (lower.includes(' vs ') || lower.includes('versus') || lower.includes('compare')) {
    return 'Those represent different design philosophies, so the better fit depends on your priorities and system.';
  }

  // Upgrade / change intent
  if (lower.includes('upgrade') || lower.includes('replace') || lower.includes('switch')) {
    if (category !== 'general') {
      return `Changing ${catName} shifts the system's character — worth thinking through.`;
    }
    return 'That\'s worth thinking through carefully — the right move depends on what you\'re hearing now and what you want to change.';
  }

  // Shopping / recommendation-seeking with category
  if (lower.includes('recommend') || lower.includes('best') || lower.includes('looking for') || lower.includes('should i get')) {
    if (category !== 'general') {
      return `There are a few good directions for ${catName} — the right one depends on your system and listening preferences.`;
    }
    return 'A few directions come to mind — the right one depends on your priorities.';
  }

  // Budget-led questions
  if (lower.includes('under $') || lower.includes('budget')) {
    if (category !== 'general') {
      return `There are solid options for ${catName} at that range.`;
    }
    return 'That budget opens up some interesting options.';
  }

  // System-building intent — user is describing what they want, not a problem.
  // Reflect priorities back in advisor voice before asking for clarification.
  if (lower.includes('build') || lower.includes('where should i start') ||
      lower.includes('getting started') || lower.includes('first system') ||
      lower.includes('want to build') || lower.includes('new stereo')) {
    if (phrases.length >= 2) {
      const topTwo = phrases.slice(0, 2).map((p) => p.toLowerCase()).join(' and ');
      return `Good starting picture — you value ${topTwo}, and you know what you don\'t want. That\'s more useful than a budget number for pointing you in the right direction.`;
    }
    if (phrases.length >= 1) {
      return `Good starting picture — ${phrases[0].toLowerCase()} tells me something about the kind of system that would work for you.`;
    }
    return 'Good starting picture — knowing what you value is the most useful starting point.';
  }

  // Describing what they hear — reflect the descriptive terms
  if (phrases.length >= 3) {
    const topTwo = phrases.slice(0, 2).map((p) => p.toLowerCase()).join(' and ');
    return `You\'re noticing ${topTwo} — that\'s a useful description of what the system is doing.`;
  }

  if (phrases.length >= 1) {
    const term = phrases[0].toLowerCase();
    return `That\'s a good observation about ${term} — it helps clarify what you\'re hearing.`;
  }

  // System description without clear problem
  if (lower.includes('my system') || lower.includes('my setup') || lower.includes('i have')) {
    return 'Good to know the system context — that shapes what would make sense.';
  }

  // True fallback — still warm, not robotic
  return 'That\'s a good starting point.';
}

/**
 * Generate an optional short context note. This is a brief neutral
 * observation that bridges the acknowledgement to the question.
 * Should feel conversational, not formulaic.
 */
function generateContext(
  questionSource: 'ambiguity' | 'shopping' | 'neutral' | 'uncertainty',
  signals: ExtractedSignals,
  turnCount: number,
): string | undefined {
  // Skip context on follow-up turns — the conversation is already flowing
  if (turnCount > 1) return undefined;

  switch (questionSource) {
    case 'ambiguity': {
      // Reference the specific ambiguous term if possible
      const ambiguousTerms = signals.matched_phrases
        .map((p) => p.toLowerCase())
        .filter((p) => ['sweet', 'smooth', 'detailed', 'warm', 'open', 'musical', 'natural', 'fast'].includes(p));
      if (ambiguousTerms.length > 0) {
        return `Different designs pursue "${ambiguousTerms[0]}" in different ways — and the distinction shapes which direction I\'d point you.`;
      }
      return 'That can mean different things to different listeners — worth clarifying before I point you in a direction.';
    }
    case 'shopping':
      if (signals.symptoms.length >= 2) {
        return 'You\'ve given a good sense of your preferences — just a couple more things would help.';
      }
      return undefined; // Let the acknowledgement carry the weight — no need to double up
    case 'neutral':
      return 'The answer depends a lot on context.';
    case 'uncertainty':
      return undefined; // The acknowledgement already covers this naturally
    default:
      return undefined;
  }
}

// ── Public API ────────────────────────────────────────

/** Default turn cap for non-shopping clarification paths. */
const DEFAULT_TURN_CAP = 2;

/**
 * Returns a structured clarification response if one would meaningfully
 * improve the next evaluation, or null if the analysis is already actionable.
 *
 * The response includes an acknowledgement, optional context, and the
 * clarifying question — following a three-step conversational structure.
 *
 * @param signals        - Extracted signals from the current evaluation
 * @param result         - Rule evaluation result
 * @param turnCount      - Number of user submissions so far (1-indexed)
 * @param userText       - The raw concatenated user input (for keyword checks)
 * @param currentMessage - The user's most recent message (for acknowledgement)
 */
export function getClarificationQuestion(
  signals: ExtractedSignals,
  result: EvaluationResult,
  turnCount: number,
  userText: string,
  currentMessage: string,
): ClarificationResponse | null {
  // Determine effective turn cap: shopping modes may allow more turns
  const shoppingCtx = detectShoppingIntent(userText, signals);
  const effectiveCap = shoppingCtx.detected
    ? getShoppingTurnCap(shoppingCtx.mode)
    : DEFAULT_TURN_CAP;

  if (turnCount >= effectiveCap) return null;

  const category = shoppingCtx.category;

  // Check cases in priority order and track which source matched
  const ambiguityQ = checkInterpretationAmbiguity(signals, result);
  if (ambiguityQ) {
    return {
      acknowledge: generateAcknowledge(signals, currentMessage, turnCount, category),
      context: generateContext('ambiguity', signals, turnCount),
      question: ambiguityQ,
    };
  }

  const shoppingQ = checkShoppingIntent(signals, userText, turnCount);
  if (shoppingQ) {
    return {
      acknowledge: generateAcknowledge(signals, currentMessage, turnCount, category),
      context: generateContext('shopping', signals, turnCount),
      question: shoppingQ,
    };
  }

  const neutralQ = checkNeutralQuestion(signals, currentMessage);
  if (neutralQ) {
    return {
      acknowledge: generateAcknowledge(signals, currentMessage, turnCount, category),
      context: generateContext('neutral', signals, turnCount),
      question: neutralQ,
    };
  }

  const uncertaintyQ = checkDiagnosticUncertainty(signals, result);
  if (uncertaintyQ) {
    return {
      acknowledge: generateAcknowledge(signals, currentMessage, turnCount, category),
      context: generateContext('uncertainty', signals, turnCount),
      question: uncertaintyQ,
    };
  }

  return null;
}
