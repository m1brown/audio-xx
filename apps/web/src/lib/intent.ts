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

/** A desire the user has expressed — "want more speed", "wish it had warmth". */
export interface DesireSignal {
  /** The quality the user wants to change. */
  quality: string;
  /** Direction: 'more' or 'less'. */
  direction: 'more' | 'less';
  /** The raw phrase that was matched. */
  raw: string;
}

/** A subject extracted from user text, tagged by kind. */
export interface SubjectMatch {
  name: string;
  kind: 'brand' | 'product';
}

export interface IntentResult {
  intent: UserIntent;
  /** Gear names or brands extracted from the message, if any. */
  subjects: string[];
  /** Structured subject matches with brand/product distinction. */
  subjectMatches: SubjectMatch[];
  /** Desired changes the user mentioned, if any. */
  desires: DesireSignal[];
}

// ── Known brands / product names ─────────────────────

/** Brand / manufacturer names — not specific models. */
const BRAND_NAMES = [
  'denafrips', 'chord', 'schiit', 'topping', 'smsl', 'gustard',
  'holo', 'benchmark', 'rme', 'mytek', 'weiss',
  'mola mola', 'rockna', 'aqua', 'lampizator', 'lampi',
  'border patrol', 'metrum', 'audio-gd', 'soekris',
  'musician', 'okto',
  'wlm', 'harbeth', 'devore', 'zu', 'klipsch', 'focal', 'boenicke',
  'pass labs', 'first watt', 'naim', 'luxman', 'accuphase',
  'parasound', 'hegel',
  'shindo', 'leben', 'audio note',
];

/** Specific product / model names. */
const PRODUCT_NAMES = [
  'spring', 'may', 'ares', 'pontus', 'venus', 'terminator',
  'bifrost', 'gungnir', 'yggdrasil', 'modi', 'modius',
  'qutest', 'hugo', 'dave', 'mojo', 'tt2',
  'dac3', 'dac4', 'adi-2', 'brooklyn', 'tambaqui',
  'wavelight', 'wavedream', 'la voce', 'formula',
  'pavane', 'adagio', 'pegasus', 'aquarius', 'draco', 'dac8',
  'diva', 'diva monitor',
  'p3esr', 'super hl5', 'orangutan', 'o/96',
  'dirty weekend', 'heresy', 'kanta', 'aria',
  'w5', 'w8', 'w11',
];

/** Combined list for backward-compatible subject extraction. */
const ALL_KNOWN_NAMES = [...BRAND_NAMES, ...PRODUCT_NAMES];

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

function extractSubjectMatches(text: string): SubjectMatch[] {
  const lower = text.toLowerCase();
  const found: SubjectMatch[] = [];
  // Check product names first (more specific — "ares" is a product, not a brand)
  for (const name of PRODUCT_NAMES) {
    if (lower.includes(name)) {
      found.push({ name, kind: 'product' });
    }
  }
  // Then check brand names, skip if already matched as product
  for (const name of BRAND_NAMES) {
    if (lower.includes(name) && !found.some((f) => f.name === name)) {
      found.push({ name, kind: 'brand' });
    }
  }
  return found;
}

function extractSubjects(text: string): string[] {
  return extractSubjectMatches(text).map((m) => m.name);
}

// ── Desire extraction ────────────────────────────────

/** Audio qualities we recognize in desire expressions. */
const KNOWN_QUALITIES = [
  'speed', 'pace', 'timing', 'attack', 'transients',
  'warmth', 'body', 'richness', 'density', 'weight',
  'detail', 'resolution', 'clarity', 'transparency',
  'flow', 'musicality', 'engagement', 'rhythm',
  'smoothness', 'ease', 'relaxation',
  'dynamics', 'punch', 'slam', 'energy',
  'soundstage', 'imaging', 'space', 'width', 'depth',
  'texture', 'grain', 'refinement',
  'air', 'openness', 'sparkle', 'extension',
  'bass', 'treble', 'midrange',
];

/** Patterns that express wanting more or less of a quality. */
const DESIRE_PATTERNS: { pattern: RegExp; direction: 'more' | 'less' }[] = [
  { pattern: /\bwant(?:s|ed|ing)?\s+more\s+(\w+)/i, direction: 'more' },
  { pattern: /\bneed(?:s|ed|ing)?\s+more\s+(\w+)/i, direction: 'more' },
  { pattern: /\blooking\s+for\s+more\s+(\w+)/i, direction: 'more' },
  { pattern: /\bwish(?:es|ed)?\s+(?:it|they)\s+had\s+more\s+(\w+)/i, direction: 'more' },
  { pattern: /\bcould\s+use\s+more\s+(\w+)/i, direction: 'more' },
  { pattern: /\bmore\s+(\w+)\s+would/i, direction: 'more' },
  { pattern: /\bwant(?:s|ed|ing)?\s+less\s+(\w+)/i, direction: 'less' },
  { pattern: /\btoo\s+much\s+(\w+)/i, direction: 'less' },
  { pattern: /\bless\s+(\w+)\s+would/i, direction: 'less' },
  { pattern: /\bwant(?:s|ed|ing)?\s+(?:it|them)\s+(?:to\s+be\s+)?(?:more\s+)?(\w+)/i, direction: 'more' },
  { pattern: /\b(?:like|love)s?\s+(?:it|my|the)\b.*\bbut\b.*\bmore\s+(\w+)/i, direction: 'more' },
  { pattern: /\b(?:like|love)s?\s+(?:it|my|the)\b.*\bbut\b.*\bless\s+(\w+)/i, direction: 'less' },
];

function extractDesires(text: string): DesireSignal[] {
  const desires: DesireSignal[] = [];
  for (const { pattern, direction } of DESIRE_PATTERNS) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const quality = match[1].toLowerCase();
      if (KNOWN_QUALITIES.includes(quality)) {
        // Avoid duplicates
        if (!desires.some((d) => d.quality === quality && d.direction === direction)) {
          desires.push({ quality, direction, raw: match[0] });
        }
      }
    }
  }
  return desires;
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
  const subjectMatches = extractSubjectMatches(currentMessage);
  const subjects = subjectMatches.map((m) => m.name);
  const desires = extractDesires(currentMessage);

  // 1. Explicit diagnosis — user describes a listening problem
  if (DIAGNOSIS_PATTERNS.some((p) => p.test(currentMessage))) {
    return { intent: 'diagnosis', subjects, subjectMatches, desires };
  }

  // 2. Comparison — "X vs Y", "compare A and B"
  if (COMPARISON_PATTERNS.some((p) => p.test(currentMessage))) {
    return { intent: 'comparison', subjects, subjectMatches, desires };
  }

  // 3. Shopping — "best DAC under $1000", "recommend a DAC"
  if (SHOPPING_PATTERNS.some((p) => p.test(currentMessage))) {
    return { intent: 'shopping', subjects, subjectMatches, desires };
  }

  // 4. Gear inquiry — "what do you think of X?" or brand mention
  //    without a listening problem.
  //    Requires a concrete subject (brand name) OR a gear-category word
  //    to avoid misclassifying vague follow-ups like "what do you think about that?"
  const hasGearPattern = GEAR_INQUIRY_PATTERNS.some((p) => p.test(currentMessage));
  const hasGearCategoryWord = /\b(?:dac|amp|amplifier|speaker|headphone|streamer|cable|turntable|phono|preamp|power\s*amp)\b/i.test(currentMessage);

  if (hasGearPattern && (subjects.length > 0 || hasGearCategoryWord)) {
    return { intent: 'gear_inquiry', subjects, subjectMatches, desires };
  }

  // 4b. Brand/product mention without any other pattern → gear inquiry
  if (subjects.length > 0) {
    return { intent: 'gear_inquiry', subjects, subjectMatches, desires };
  }

  // 5. Default — treat as diagnostic / open-ended listening discussion
  return { intent: 'diagnosis', subjects, subjectMatches, desires };
}

/**
 * Returns true if all subject matches are brand-level (no specific products).
 * Used to distinguish brand comparisons from product comparisons.
 */
export function isBrandOnlyComparison(matches: SubjectMatch[]): boolean {
  return matches.length >= 2 && matches.every((m) => m.kind === 'brand');
}
