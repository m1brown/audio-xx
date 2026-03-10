/**
 * Churn avoidance — discourages impulsive upgrade decisions.
 *
 * The advisor should slow down users who show signs of:
 *   - Upgrade restlessness without a clear symptom
 *   - Frequent system changes
 *   - Vague dissatisfaction without a specific complaint
 *
 * When churn signals are detected, the engine inserts a reflective
 * question before offering directional paths. This is a gate, not
 * a block — it encourages deliberation, not inaction.
 *
 * Design rule: "Acting without a clear symptom often leads to
 * unnecessary churn."
 */

// ── Churn signal patterns ───────────────────────────

/** Vague upgrade intent — user wants to change something but hasn't said why. */
const VAGUE_UPGRADE_PATTERNS: RegExp[] = [
  /\bshould\s+i\s+upgrade\b/i,
  /\bis\s+it\s+(?:time|worth)\s+(?:to\s+)?upgrade\b/i,
  /\bthinking\s+(?:about|of)\s+(?:upgrading|replacing|switching)\b/i,
  /\bwant\s+(?:to\s+)?(?:try|change|switch|replace)\s+(?:my|the)\b/i,
  /\bfeeling\s+(?:like|the\s+urge)\s+(?:to\s+)?(?:upgrade|change)\b/i,
  /\bgetting\s+(?:bored|restless|the\s+itch)\b/i,
  /\bmaybe\s+(?:i\s+)?(?:should|need\s+to)\s+(?:get|buy|try)\b/i,
  /\bwondering\s+if\s+(?:i\s+)?(?:should|need)\b/i,
  /\bitch\s+to\s+upgrade\b/i,
  /\bupgrade\s+(?:bug|fever|itch)\b/i,
];

/** Explicit recent change — user may be churning. */
const RECENT_CHANGE_PATTERNS: RegExp[] = [
  /\bjust\s+(?:got|bought|changed|replaced|switched|upgraded)\b/i,
  /\brecently\s+(?:got|bought|changed|replaced|switched|upgraded)\b/i,
  /\bnew\s+(?:dac|amp|amplifier|speakers?|headphones?)\b/i,
  /\balready\s+(?:changed|swapped|tried)\s+(?:a\s+few|several|multiple)\b/i,
];

/** Clear symptom present — user has a concrete complaint. */
const CLEAR_SYMPTOM_PATTERNS: RegExp[] = [
  /\bsounds?\s+(?:too|a\s+bit|overly|really)\s+\w+/i,
  /\btoo\s+(?:bright|warm|thin|harsh|lean|dense|slow|fast|muddy|dark|sharp|clinical)\b/i,
  /\blacks?\s+(?:\w+)\b/i,
  /\bno\s+(?:bass|treble|punch|dynamics?|detail|body|warmth|clarity|air)\b/i,
  /\bfatiguing\b/i,
  /\bharsh\b/i,
  /\bsibilant\b/i,
  /\bgrain(?:y)?\b/i,
  /\bglare\b/i,
  /\bbloated\b/i,
  /\bmuddy\b/i,
  /\bcongested\b/i,
  /\bboring\b/i,
  /\blifeless\b/i,
];

// ── Churn detection ─────────────────────────────────

export interface ChurnSignal {
  /** Whether churn signals were detected. */
  detected: boolean;
  /** The type of churn signal. */
  kind: 'vague_upgrade' | 'recent_change' | null;
  /** A reflective question to insert before directional paths. */
  reflectiveQuestion: string | null;
}

/**
 * Detect churn signals in user text.
 *
 * Returns a ChurnSignal with a reflective question when:
 *   1. User shows vague upgrade intent without a clear symptom
 *   2. User mentions recent changes (possible churn pattern)
 *
 * Returns detected=false when:
 *   - User has a clear symptom (they know what's wrong)
 *   - No upgrade language is present
 *   - User is shopping with a stated preference
 */
export function detectChurnSignal(userText: string): ChurnSignal {
  const hasClearSymptom = CLEAR_SYMPTOM_PATTERNS.some((p) => p.test(userText));

  // If the user has a concrete complaint, no churn gate needed
  if (hasClearSymptom) {
    return { detected: false, kind: null, reflectiveQuestion: null };
  }

  const hasVagueUpgrade = VAGUE_UPGRADE_PATTERNS.some((p) => p.test(userText));
  const hasRecentChange = RECENT_CHANGE_PATTERNS.some((p) => p.test(userText));

  // Vague upgrade + no clear symptom → reflective question
  if (hasVagueUpgrade) {
    // If they also recently changed, stronger churn signal
    if (hasRecentChange) {
      return {
        detected: true,
        kind: 'recent_change',
        reflectiveQuestion:
          'It sounds like you\'ve made some changes recently. Before considering another move — what specifically about the current sound isn\'t working for you? Sometimes a new component needs time to settle into a system.',
      };
    }

    return {
      detected: true,
      kind: 'vague_upgrade',
      reflectiveQuestion:
        'What specifically prompted this consideration? If there\'s a particular quality you\'re missing or a frustration with the current sound, that helps point toward whether a change would actually improve things — or just shift the balance.',
    };
  }

  // Recent change alone (without upgrade language) — lighter check
  if (hasRecentChange) {
    return {
      detected: true,
      kind: 'recent_change',
      reflectiveQuestion:
        'Since the change is recent, it may be worth living with it a bit longer before making another move. What are you hearing that\'s prompting the next question?',
    };
  }

  return { detected: false, kind: null, reflectiveQuestion: null };
}

/**
 * Build a churn-aware framing note for gear responses.
 *
 * When churn is detected, returns a sentence that gently encourages
 * the user to clarify their motivation before proceeding.
 * Returns undefined when no churn signal is present.
 */
export function buildChurnNote(churn: ChurnSignal): string | undefined {
  if (!churn.detected) return undefined;

  if (churn.kind === 'recent_change') {
    return 'Since you\'ve made changes recently, it\'s worth checking whether what you\'re hearing is a genuine limitation or just the system finding its new equilibrium.';
  }

  return 'When the motivation is general rather than specific, changes tend to shift the balance without necessarily improving it. Identifying a concrete quality you want more or less of is usually the first step.';
}
