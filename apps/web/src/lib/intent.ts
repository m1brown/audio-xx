/**
 * Intent detection layer.
 *
 * Runs BEFORE the evaluation engine to determine how the system
 * should respond. This prevents gear inquiries, shopping questions,
 * and comparisons from falling into the diagnostic/symptom workflow.
 *
 * Supported intents:
 *   1. gear_inquiry  — "What do you think of Denafrips?"
 *   2. shopping       — "Best DAC under $1000"
 *   3. comparison     — "Denafrips vs Chord"
 *   4. diagnosis      — "My system sounds bright" (default)
 */

// ── Intent type ──────────────────────────────────────

export type UserIntent = 'gear_inquiry' | 'shopping' | 'comparison' | 'diagnosis';

export interface IntentResult {
  intent: UserIntent;
  /** Gear names or brands extracted from the message, if any. */
  subjects: string[];
}

// ── Known brands / product names ─────────────────────

const KNOWN_BRANDS = [
  'denafrips', 'chord', 'schiit', 'topping', 'smsl', 'gustard',
  'holo', 'spring', 'may', 'ares', 'pontus', 'venus', 'terminator',
  'bifrost', 'gungnir', 'yggdrasil', 'modi', 'modius',
  'qutest', 'hugo', 'dave', 'mojo', 'tt2',
  'benchmark', 'dac3', 'dac4',
  'rme', 'adi-2',
  'mytek', 'brooklyn',
  'weiss',
  'mola mola', 'tambaqui',
  'rockna', 'wavelight', 'wavedream',
  'aqua', 'la voce', 'formula',
  'lampizator', 'lampi',
  'border patrol',
  'metrum', 'pavane', 'adagio',
  'audio-gd',
  'soekris',
  'musician', 'pegasus', 'aquarius', 'draco',
  'okto', 'dac8',
  'wlm', 'diva',
  'harbeth', 'devore', 'zu', 'klipsch', 'focal',
  'pass labs', 'first watt', 'naim', 'luxman', 'accuphase',
  'parasound', 'hegel',
];

// ── Comparison patterns ──────────────────────────────

const COMPARISON_PATTERNS = [
  /\bvs\.?\b/i,
  /\bversus\b/i,
  /\bcompare[ds]?\b/i,
  /\bcomparison\b/i,
  /\bbetween\b.*\band\b/i,
  /\bdifference[s]?\s+between\b/i,
  /\bor\b.*\bfor\b/i,          // "Bifrost or Pontus for my system"
  /\bhow\s+(?:does|do)\b.*\bcompare\b/i,
];

// ── Shopping patterns ────────────────────────────────

const SHOPPING_PATTERNS = [
  /\bbest\b/i,
  /\brecommend(?:ation)?s?\b/i,
  /\blooking\s+for\b/i,
  /\bshould\s+i\s+(?:get|buy|pick)\b/i,
  /\bwhat\s+(?:dac|amp|amplifier|speaker|headphone|streamer|cable)\b/i,
  /\bunder\s+\$\d/i,
  /\bbudget\b.*\b(?:dac|amp|speaker|headphone|streamer)\b/i,
  /\b(?:dac|amp|speaker|headphone|streamer)\b.*\bbudget\b/i,
  /\bfor\s+(?:speed|warmth|detail|clarity|dynamics|punch|flow)\b/i,
  /\bwhat\s+would\s+you\s+suggest\b/i,
  /\bany\s+suggestions\b/i,
  /\bwhat\s+should\s+i\b/i,
  /\bgood\s+(?:dac|amp|amplifier|speaker|headphone|streamer)\b/i,
  /\b(?:dac|amp|amplifier|speaker|headphone|streamer)\s+(?:for|that)\b/i,
];

// ── Gear inquiry patterns ────────────────────────────

const GEAR_INQUIRY_PATTERNS = [
  /\bwhat\s+do\s+you\s+think\s+(?:of|about)\b/i,
  /\bthoughts\s+on\b/i,
  /\bopinion[s]?\s+on\b/i,
  /\bwhat\s+are\s+your\s+thoughts\b/i,
  /\bhow\s+(?:good|would you rate)\b/i,
  /\bis\s+(?:the|a|an)\s+.+\s+(?:good|worth|any\s+good)\b/i,
  /\bany\s+experience\s+with\b/i,
  /\bhave\s+you\s+heard\b/i,
  /\bknow\s+anything\s+about\b/i,
  /\btell\s+me\s+about\b/i,
  /\bwhat\s+(?:is|are)\s+(?:the\s+)?(?:character|sound|signature|house sound)\b/i,
  /\bhow\s+(?:does|do)\s+(?:the\s+)?(?:\w+\s+)?sound\b/i,
];

// ── Diagnosis patterns ───────────────────────────────
// These signal a listening problem or system symptom.

const DIAGNOSIS_PATTERNS = [
  /\bmy\s+system\s+sounds?\b/i,
  /\bmy\s+setup\s+(?:sounds?|is|feels?)\b/i,
  /\bsounds?\s+(?:too\s+)?(?:bright|thin|harsh|fatiguing|muddy|dull|veiled|grainy|flat|boring|lifeless|congested|sibilant)\b/i,
  /\blacking\s+(?:in\s+)?(?:bass|treble|detail|warmth|body|dynamics|punch|clarity|air|space|depth)\b/i,
  /\btoo\s+much\s+(?:brightness|treble|bass|warmth|sibilance|glare)\b/i,
  /\bwhy\s+does\s+(?:my|the)\b/i,
  /\b(?:bothers?|annoys?|fatigues?)\s+me\b/i,
  /\blistening\s+fatigue\b/i,
  /\bnot\s+(?:enough|happy|satisfied)\b/i,
  /\bsomething\s+(?:is\s+)?(?:off|wrong|missing)\b/i,
  /\bi\s+(?:don't|don't)\s+like\s+(?:the|how)\b/i,
  /\b(?:problem|issue)\s+with\b/i,
];

// ── Subject extraction ───────────────────────────────

function extractSubjects(text: string): string[] {
  const lower = text.toLowerCase();
  const found: string[] = [];
  for (const brand of KNOWN_BRANDS) {
    if (lower.includes(brand)) {
      found.push(brand);
    }
  }
  return found;
}

// ── Public API ───────────────────────────────────────

/**
 * Detect the user's intent from their most recent message.
 *
 * Priority order:
 *   1. Diagnosis (explicit listening problem)
 *   2. Comparison (vs / compare)
 *   3. Shopping (recommend / best / looking for)
 *   4. Gear inquiry (what do you think / brand mention without problem)
 *   5. Diagnosis fallback (when nothing else matches)
 *
 * Diagnosis gets highest priority because if a user says
 * "my system sounds bright, what do you think of the Bifrost?"
 * the listening problem should drive the response.
 */
export function detectIntent(currentMessage: string): IntentResult {
  const subjects = extractSubjects(currentMessage);

  // 1. Explicit diagnosis — user describes a listening problem
  if (DIAGNOSIS_PATTERNS.some((p) => p.test(currentMessage))) {
    return { intent: 'diagnosis', subjects };
  }

  // 2. Comparison — "X vs Y", "compare A and B"
  if (COMPARISON_PATTERNS.some((p) => p.test(currentMessage))) {
    return { intent: 'comparison', subjects };
  }

  // 3. Shopping — "best DAC under $1000", "recommend a DAC"
  if (SHOPPING_PATTERNS.some((p) => p.test(currentMessage))) {
    return { intent: 'shopping', subjects };
  }

  // 4. Gear inquiry — "what do you think of X?" or brand mention
  //    without a listening problem.
  //    Requires a concrete subject (brand name) OR a gear-category word
  //    to avoid misclassifying vague follow-ups like "what do you think about that?"
  const hasGearPattern = GEAR_INQUIRY_PATTERNS.some((p) => p.test(currentMessage));
  const hasGearCategoryWord = /\b(?:dac|amp|amplifier|speaker|headphone|streamer|cable|turntable|phono|preamp|power\s*amp)\b/i.test(currentMessage);

  if (hasGearPattern && (subjects.length > 0 || hasGearCategoryWord)) {
    return { intent: 'gear_inquiry', subjects };
  }

  // 4b. Brand/product mention without any other pattern → gear inquiry
  if (subjects.length > 0) {
    return { intent: 'gear_inquiry', subjects };
  }

  // 5. Default — treat as diagnostic / open-ended listening discussion
  return { intent: 'diagnosis', subjects };
}
