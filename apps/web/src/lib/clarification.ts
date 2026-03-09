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
  return getShoppingClarification(ctx, turnCount);
}

// ── Acknowledgement generation ────────────────────────

/**
 * Generate a short acknowledgement based on what signals were
 * detected in the user's message. This mirrors back what the
 * user seems to be describing or asking about.
 *
 * The acknowledgement is conversational and non-diagnostic —
 * it does not assume the user has a problem unless they say so.
 */
function generateAcknowledge(
  signals: ExtractedSignals,
  currentMessage: string,
  turnCount: number,
): string {
  // On follow-up turns (not the first message), keep acknowledgements brief
  if (turnCount > 1) {
    if (signals.matched_phrases.length > 0) {
      return 'Got it — that helps narrow things down.';
    }
    return 'Thanks for the additional context.';
  }

  // First turn: acknowledge what they seem to be describing
  const phrases = signals.matched_phrases;
  const lower = currentMessage.toLowerCase();

  // Shopping / recommendation-seeking
  if (lower.includes('recommend') || lower.includes('best') || lower.includes('looking for')) {
    return 'Good question — there are a few directions worth considering.';
  }

  if (lower.includes('upgrade') || lower.includes('replace') || lower.includes('switch')) {
    return 'That\'s a worthwhile thing to think through carefully.';
  }

  if (lower.includes('compare') || lower.includes(' vs ') || lower.includes('versus')) {
    return 'Those are worth comparing — they represent different design priorities.';
  }

  // Descriptions of what they hear
  if (phrases.length >= 3) {
    return 'You\'re describing a clear listening impression — that\'s useful context.';
  }

  if (phrases.length >= 1) {
    return 'That gives a good starting point.';
  }

  // Fallback — generic but warm
  return 'Interesting question.';
}

/**
 * Generate an optional short context note based on the
 * type of clarification being asked. This provides a brief
 * neutral observation before the question.
 */
function generateContext(
  questionSource: 'ambiguity' | 'shopping' | 'uncertainty',
  signals: ExtractedSignals,
): string | undefined {
  switch (questionSource) {
    case 'ambiguity':
      return 'That term can mean different things to different listeners, so it helps to be specific.';
    case 'shopping':
      if (signals.symptoms.length >= 2) {
        return 'A few things would help point toward the right direction.';
      }
      return 'To give you a useful direction rather than a generic one, a bit more context would help.';
    case 'uncertainty':
      return 'There are a few different things that could be going on — a bit more detail would help.';
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

  // Check cases in priority order and track which source matched
  const ambiguityQ = checkInterpretationAmbiguity(signals, result);
  if (ambiguityQ) {
    return {
      acknowledge: generateAcknowledge(signals, currentMessage, turnCount),
      context: generateContext('ambiguity', signals),
      question: ambiguityQ,
    };
  }

  const shoppingQ = checkShoppingIntent(signals, userText, turnCount);
  if (shoppingQ) {
    return {
      acknowledge: generateAcknowledge(signals, currentMessage, turnCount),
      context: generateContext('shopping', signals),
      question: shoppingQ,
    };
  }

  const uncertaintyQ = checkDiagnosticUncertainty(signals, result);
  if (uncertaintyQ) {
    return {
      acknowledge: generateAcknowledge(signals, currentMessage, turnCount),
      context: generateContext('uncertainty', signals),
      question: uncertaintyQ,
    };
  }

  return null;
}
