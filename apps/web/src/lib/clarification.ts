/**
 * Lightweight clarification layer.
 *
 * Determines whether a follow-up question would meaningfully improve
 * the next evaluation pass. Returns null when the analysis is already
 * actionable or when the conversation has reached its turn cap.
 */
import type { ExtractedSignals } from './signal-types';
import type { EvaluationResult } from './rule-types';
import { detectShoppingIntent, getShoppingClarification } from './shopping-intent';

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
      'When you say sweetness, do you mean a richer, golden tone — or mainly the absence of harshness and sterility?',
  },
  {
    triggers: ['smooth', 'smoothness'],
    question:
      'Does smooth mean relaxed and forgiving, or fluid and continuous?',
  },
  {
    triggers: ['detailed', 'detail', 'resolving'],
    question:
      'When you say detailed, do you mean micro-detail retrieval, or more presence and articulation?',
  },
  {
    triggers: ['warm', 'warmth'],
    question:
      'Does warm mean fuller and denser in the lower midrange, or just less bright and less fatiguing?',
  },
  {
    triggers: ['open', 'openness', 'airy'],
    question:
      'When you say open, do you mean wider spatial presentation, or more treble extension and air?',
  },
  {
    triggers: ['musical', 'musicality'],
    question:
      'When you say musical, do you mean rhythmic engagement and flow, or tonal beauty and harmonic richness?',
  },
  {
    triggers: ['natural', 'organic'],
    question:
      'Does natural mean timbral accuracy, or a relaxed non-mechanical quality?',
  },
  {
    triggers: ['fast', 'speed', 'quick'],
    question:
      'When you say fast, do you mean transient attack and leading edges, or overall pace and rhythmic drive?',
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
    return 'Could you describe what specifically bothers or pleases you — is it a tonal quality, a spatial characteristic, or something about timing and rhythm?';
  }

  return null;
}

// ── Case 3: Shopping Intent ──────────────────────────

function checkShoppingIntent(
  signals: ExtractedSignals,
  userText: string,
): string | null {
  const ctx = detectShoppingIntent(userText, signals);
  if (!ctx.detected) return null;
  return getShoppingClarification(ctx);
}

// ── Public API ────────────────────────────────────────

/**
 * Returns a clarifying question if one would meaningfully improve
 * the next evaluation, or null if the analysis is already actionable.
 *
 * @param signals  - Extracted signals from the current evaluation
 * @param result   - Rule evaluation result
 * @param turnCount - Number of user submissions so far (1-indexed)
 * @param userText - The raw concatenated user input (for keyword checks)
 */
export function getClarificationQuestion(
  signals: ExtractedSignals,
  result: EvaluationResult,
  turnCount: number,
  userText: string,
): string | null {
  // Hard cap: never ask after the second user turn
  if (turnCount >= 2) return null;

  // Check cases in priority order:
  // 1. Interpretation ambiguity (specific phrase clarification)
  // 2. Shopping intent without context (before generic uncertainty,
  //    because low-info shopping prompts would otherwise trigger
  //    a generic diagnostic question instead of a useful one)
  // 3. Diagnostic uncertainty (generic low-information fallback)
  return (
    checkInterpretationAmbiguity(signals, result) ??
    checkShoppingIntent(signals, userText) ??
    checkDiagnosticUncertainty(signals, result) ??
    null
  );
}
