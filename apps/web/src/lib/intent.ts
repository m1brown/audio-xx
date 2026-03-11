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

export type UserIntent = 'gear_inquiry' | 'shopping' | 'comparison' | 'diagnosis' | 'system_assessment' | 'consultation_entry' | 'cable_advisory';

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
  // DAC / digital
  'denafrips', 'chord', 'schiit', 'topping', 'smsl', 'gustard',
  'holo', 'benchmark', 'rme', 'mytek', 'weiss',
  'mola mola', 'rockna', 'aqua', 'lampizator', 'lampi',
  'border patrol', 'metrum', 'audio-gd', 'soekris',
  'musician', 'okto',
  // Speakers
  'wlm', 'harbeth', 'devore', 'zu', 'klipsch', 'focal', 'boenicke',
  'kef', 'b&w', 'bowers', 'dynaudio', 'wilson', 'magico',
  'sonus faber', 'proac', 'spendor', 'atc', 'tannoy',
  'magnepan', 'martin logan', 'quad',
  // Amplifiers
  'pass labs', 'first watt', 'naim', 'luxman', 'accuphase',
  'parasound', 'hegel', 'mcintosh', 'marantz', 'yamaha',
  'shindo', 'leben', 'audio note',
  'line magnetic', 'primaluna', 'cary', 'arc', 'audio research',
  'job',
  // Turntables
  'rega', 'pro-ject', 'technics', 'clearaudio', 'vpi',
  'linn', 'thorens',
  // Headphones / IEMs
  'sennheiser', 'sony', 'audio-technica', 'beyerdynamic',
  'hifiman', 'audeze', 'shure', 'etymotic',
  'moondrop', 'apple',
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
  'p3esr', 'super hl5', 'orangutan', 'o/96', 'o96',
  'dirty weekend', 'heresy', 'kanta', 'aria',
  'w5', 'w8', 'w11',
  // Turntables
  'planar 3', 'planar 6', 'planar 8', 'planar 10',
  'sl-1200', 'sl-1500c', 'sl-1210',
  'x2 b', 'x8',
  // Headphones / IEMs
  'hd 600', 'hd 650', 'hd 800', 'hd 800 s', 'momentum 4',
  'wh-1000xm5', 'wh-1000xm4',
  'airpods pro', 'airpods pro 2',
  'aria 2', 'blessing 3', 'kato',
  'er2xr', 'er2se', 'aonic 3',
  'ath-m50x', 'ath-m50xbt2',
  'sundara', 'edition xs',
];

/** Combined list for backward-compatible subject extraction. */
const ALL_KNOWN_NAMES = [...BRAND_NAMES, ...PRODUCT_NAMES];

// ── Cable intent patterns ────────────────────────────
// Detects cable-focused queries — speaker cables, interconnects, RCAs, etc.
// Must be checked before shopping to route into the structured cable advisory.

const CABLE_INTENT_PATTERNS = [
  /\bspeaker\s+cables?\b/i,
  /\brca\s+cables?\b/i,
  /\binterconnects?\b/i,
  /\bpower\s+(?:cord|cable)s?\b/i,
  /\busb\s+cables?\b/i,
  /\bdigital\s+cables?\b/i,
  /\bxlr\s+cables?\b/i,
  /\banalog\s+cables?\b/i,
  /\bcabling\b/i,
  /\bcable\s+(?:recommendation|suggestion|advice|upgrade)\b/i,
  /\b(?:best|good|recommend)\b.*\bcables?\b/i,
  /\bcables?\s+for\b/i,
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

// ── System assessment patterns ────────────────────────
// These signal a system-level evaluation request, distinct from diagnosis.
// Requires ownership language + assessment intent; no listening complaint.

const SYSTEM_ASSESSMENT_PATTERNS = [
  /\bassess(?:ment)?\s+(?:of\s+)?(?:my|the)\s+(?:current\s+)?(?:system|setup|rig|chain)\b/i,
  /\bevaluat(?:e|ion)\s+(?:of\s+)?(?:my|the)\s+(?:current\s+)?(?:system|setup|rig|chain)\b/i,
  /\bwhat\s+do\s+you\s+think\s+(?:of|about)\s+my\s+(?:current\s+)?(?:system|setup|rig|chain)\b/i,
  /\bthoughts\s+on\s+my\s+(?:current\s+)?(?:system|setup|rig|chain)\b/i,
  /\bhow\s+does\s+my\s+(?:system|setup|rig|chain)\s+(?:look|seem|stack\s+up)\b/i,
  /\breview\s+(?:of\s+)?my\s+(?:current\s+)?(?:system|setup|rig|chain)\b/i,
  /\bopinion\s+on\s+my\s+(?:current\s+)?(?:system|setup|rig|chain)\b/i,
];

/** Broader system guidance patterns — user wants help with their system
 *  but may not use "assessment" or "evaluate" specifically. */
const SYSTEM_GUIDANCE_PATTERNS = [
  ...SYSTEM_ASSESSMENT_PATTERNS,
  /\bsuggestions?\s+(?:on|for)\s+(?:areas?\s+to\s+)?(?:upgrade|improve|change)\b/i,
  /\bhelp\s+(?:me\s+)?(?:improve|upgrade|optimize)\s+(?:my\s+)?(?:system|setup|rig|chain)\b/i,
  /\bwhat\s+(?:should|would|could)\s+i\s+(?:upgrade|improve|change)\b/i,
  /\bwhere\s+(?:should|would|could)\s+i\s+(?:upgrade|improve|start)\b/i,
  /\bareas?\s+to\s+(?:upgrade|improve|focus\s+on)\b/i,
  /\bnext\s+(?:step|upgrade|move)\s+for\s+(?:my\s+)?(?:system|setup|rig)\b/i,
  /\badvice\s+(?:on|for|about)\s+(?:my\s+)?(?:system|setup|rig|chain)\b/i,
];

/** Ownership language — indicates user is describing components they own. */
const OWNERSHIP_PATTERNS = [
  /\bi\s+have\b/i,
  /\bmy\s+(?:current\s+)?(?:system|setup|rig|chain)\b/i,
  /\bi(?:'m|\s+am)\s+(?:running|using)\b/i,
  /\bi\s+(?:run|use)\b/i,
  /\bmy\s+(?:dac|amp|amplifier|speakers?|headphones?|streamer)\b/i,
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
  'glare', 'sibilance', 'harshness', 'fatigue',
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

  // 1b. System assessment — user describes their system and asks for evaluation
  //     Requires explicit assessment language + ownership language + multiple subjects.
  //     This must fire before comparison to prevent "I have X, Y, and Z" from
  //     being treated as "X vs Y".
  const hasAssessmentLanguage = SYSTEM_ASSESSMENT_PATTERNS.some((p) => p.test(currentMessage));
  const hasOwnership = OWNERSHIP_PATTERNS.some((p) => p.test(currentMessage));
  if (hasAssessmentLanguage && hasOwnership && subjectMatches.length >= 2) {
    return { intent: 'system_assessment', subjects, subjectMatches, desires };
  }

  // 1c. Consultation entry — user asks for system assessment/upgrade guidance
  //     but hasn't named specific gear yet. This produces a structured intake
  //     response instead of falling through to generic shopping.
  const hasGuidanceLanguage = SYSTEM_GUIDANCE_PATTERNS.some((p) => p.test(currentMessage));
  if ((hasAssessmentLanguage || hasGuidanceLanguage) && hasOwnership) {
    return { intent: 'consultation_entry', subjects, subjectMatches, desires };
  }

  // 1d. Cable advisory — user asks about cables in a system context.
  //     Must fire before shopping to prevent cable queries from getting
  //     generic shopping treatment. Requires cable language.
  const hasCableLanguage = CABLE_INTENT_PATTERNS.some((p) => p.test(currentMessage));
  if (hasCableLanguage) {
    return { intent: 'cable_advisory', subjects, subjectMatches, desires };
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

// ── Comparison follow-up detection ──────────────────

/**
 * Patterns that indicate a follow-up question about an active comparison.
 * These are elliptical — they omit the comparison subjects and rely on
 * the stored context to resolve "which" or "what" against.
 */
const COMPARISON_FOLLOWUP_PATTERNS = [
  /\bwhich\b.*\b(?:better|worse|more|less|warmer|brighter|cooler|richer|thinner|fuller|faster|slower)\b/i,
  /\bwhat(?:'s| is)\s+better\b/i,
  /\bwhat\s+about\b/i,
  /\bhow\s+(?:about|do they differ|do they compare)\b/i,
  /\bfor\s+(?:tubes?|solid[- ]state|small\s+rooms?|large\s+rooms?|near[- ]field|low[- ]power|high[- ]power|vinyl|digital|streaming)\b/i,
  /\bwith\s+(?:tubes?|solid[- ]state|low[- ]power|high[- ]power|a\s+\w+\s+amp)\b/i,
  /\bwhich\s+(?:one|is|has|would|should|do)\b/i,
  /\band\s+(?:what|how)\s+about\b/i,
];

/**
 * Check whether a message is a follow-up to an active comparison.
 *
 * Returns true when:
 *   - An active comparison exists, AND
 *   - The message matches a follow-up pattern, OR
 *   - The message introduces no new subjects (elliptical reference)
 *
 * Does NOT return true if the message contains new subjects that
 * differ from the active comparison (indicates a topic change).
 */
export function isComparisonFollowUp(
  text: string,
  activeComparison: { left: SubjectMatch; right: SubjectMatch } | undefined,
): boolean {
  if (!activeComparison) return false;

  // Check if message introduces new, unrelated subjects
  const newMatches = extractSubjectMatches(text);
  if (newMatches.length > 0) {
    const activeNames = new Set([
      activeComparison.left.name.toLowerCase(),
      activeComparison.right.name.toLowerCase(),
    ]);
    const hasNewSubject = newMatches.some((m) => !activeNames.has(m.name.toLowerCase()));
    if (hasNewSubject) return false; // Topic changed
  }

  // Check follow-up patterns
  return COMPARISON_FOLLOWUP_PATTERNS.some((p) => p.test(text));
}

// ── Context enrichment detection ──────────────────────
//
// Detects when the user is providing system context (amplifier,
// speakers, room, music, listening priorities) rather than asking
// a new question or shifting topic. Used to keep the conversation
// in its active mode (comparison, shopping, consultation-with-fit)
// instead of falling through to diagnostic evaluation.

const CONTEXT_ENRICHMENT_PATTERNS = [
  // Amplifier / source context — "my amp is…", "I'm using…", "driven by…"
  /\bmy\s+(?:amp(?:lifier)?|preamp|integrated|receiver|dac|source|streamer|turntable|phono)\s+is\b/i,
  /\b(?:i(?:'m|\s+am)\s+)?(?:using|running|driving\s+(?:them|it)\s+with|pairing\s+(?:it|them)\s+with|powering)\b/i,
  /\bdriven\s+by\b/i,
  /\bpowered\s+by\b/i,
  /\bfed\s+by\b/i,
  /\bamp\s+is\s+(?:a\s+)?/i,

  // Speaker context — "my speakers are…", "I have…"
  /\bmy\s+speakers?\s+(?:are|is)\b/i,
  /\bi\s+have\s+(?:a\s+pair\s+of|the)\s+/i,
  // "I have a tube amp", "i have an SET amp", "i have a Shindo preamp"
  /\bi\s+have\s+(?:a|an)\s+(?:\w+\s+)*(?:amp(?:lifier)?|preamp|integrated|receiver|dac|speakers?|turntable|phono|streamer|sub(?:woofer)?)\b/i,

  // Room context — "small room", "nearfield", "12x14 room"
  /\b(?:small|large|medium|big|tiny)\s+room\b/i,
  /\bnear[- ]?field\b/i,
  /\b\d+\s*(?:x|by)\s*\d+\s*(?:room|space|feet|ft)?\b/i,
  /\blistening\s+(?:room|space|distance)\b/i,
  /\bapartment\b/i,
  /\bdesk(?:top)?\s+(?:setup|system)\b/i,

  // Music preferences — "mostly jazz", "I listen to…"
  /\b(?:mostly|mainly|primarily)\s+(?:jazz|classical|rock|electronic|vocal|acoustic|pop|metal|folk|blues|hip[- ]hop)\b/i,
  /\bi\s+(?:listen\s+to|play|enjoy)\s+(?:a\s+lot\s+of\s+)?/i,
  /\bmy\s+(?:music|listening)\s+is\s+(?:mostly|mainly|primarily)\b/i,

  // Listening priorities — "I care about…", "most important to me…"
  /\bi\s+(?:care|value|prioriti[sz]e)\s+/i,
  /\bmost\s+important\s+(?:to\s+me|thing)\b/i,
  /\bi\s+(?:want|need|prefer)\s+(?:more\s+)?(?:warmth|detail|clarity|bass|body|flow|rhythm|dynamics|soundstage|imaging)\b/i,

  // Power context — "300B tubes", "8 watts", "SET amp"
  /\b\d+\s*(?:watt|w)\b/i,
  /\b(?:300b|2a3|el34|kt88|kt120|kt150|6550|845|211)\b/i,
  /\b(?:set|push[- ]pull|single[- ]ended|class[- ]?a)\s+(?:amp|amplifier|design)?\b/i,

  // Budget / price context added mid-conversation
  /\bbudget\s+(?:is|around|about)\b/i,
  /\bi(?:'d| would)\s+spend\s+/i,
];

/**
 * Detect whether a message is providing system context rather than
 * asking a new question or describing a problem.
 *
 * Returns the category of context provided, or null if not detected.
 *
 * Important: this should only be checked when an active conversation
 * mode exists (comparison, shopping, consultation-with-fit). On a
 * cold start, "my amp is X" should route normally.
 */
export type ContextKind = 'amplifier' | 'speaker' | 'room' | 'music' | 'listening_priority' | 'power' | 'budget' | 'general_system';

export function detectContextEnrichment(text: string): ContextKind | null {
  const lower = text.toLowerCase();

  // Reject if the message also contains a clear diagnostic symptom —
  // "my amp is bright and fatiguing" is a diagnosis, not context enrichment
  if (/\bsounds?\s+(?:too\s+)?(?:bright|thin|harsh|fatiguing|muddy|dull|veiled|grainy|flat|boring|lifeless|congested|sibilant)\b/i.test(lower)) {
    return null;
  }
  if (/\bsomething\s+(?:is\s+)?(?:off|wrong|missing)\b/i.test(lower)) {
    return null;
  }

  // Check if any enrichment pattern matches
  if (!CONTEXT_ENRICHMENT_PATTERNS.some((p) => p.test(text))) {
    return null;
  }

  // Classify the kind of context
  if (/\bamp(?:lifier)?|preamp|integrated|receiver|driven\s+by|powered\s+by|300b|2a3|el34|kt88|kt120|kt150|6550|845|211|set\b|push[- ]pull|single[- ]ended|class[- ]?a|\d+\s*(?:watt|w)\b/i.test(lower)) {
    return 'amplifier';
  }
  if (/\bspeakers?\b/i.test(lower)) return 'speaker';
  if (/\broom\b|near[- ]?field|apartment|desk|listening\s+(?:distance|space)|\d+\s*(?:x|by)\s*\d+/i.test(lower)) return 'room';
  if (/\bjazz|classical|rock|electronic|vocal|acoustic|pop|metal|folk|blues|hip[- ]hop|listen\s+to|music\b/i.test(lower)) return 'music';
  if (/\bcare|value|prioriti[sz]e|most\s+important|want\s+more|need\s+more|prefer/i.test(lower)) return 'listening_priority';
  if (/\bbudget|spend/i.test(lower)) return 'budget';
  return 'general_system';
}

// ── Consultation follow-up detection ──────────────────
//
// Detects when the user is asking a follow-up to an active consultation
// (gear inquiry or brand consultation). Examples:
//   "devore o96 thoughts?" → "but aren't there smaller models?"
//   "what is shindo known for?" → "what about their amps?"
//   "tell me about harbeth" → "how do they compare to spendor?"

/**
 * Patterns that indicate a follow-up within an ongoing consultation.
 * These are elliptical — they reference the prior subject implicitly.
 */
const CONSULTATION_FOLLOWUP_PATTERNS = [
  // Asking about variants / models / alternatives
  /\b(?:aren't|isn't|are)\s+there\s+(?:smaller|larger|bigger|cheaper|other|different|more\s+\w+)\s+(?:models?|versions?|options?|speakers?|dacs?|amps?)\b/i,
  /\bwhat\s+about\s+(?:the\s+)?(?:smaller|larger|bigger|cheaper|other)\b/i,
  /\bdo\s+they\s+(?:make|have|offer)\b/i,
  /\bany\s+(?:smaller|larger|cheaper|other|different|similar)\s+(?:models?|versions?|options?)\b/i,
  /\bother\s+(?:models?|versions?|products?|options?)\b/i,
  /\bsmaller\s+(?:models?|versions?|speakers?)\b/i,
  /\blarger\s+(?:models?|versions?|speakers?)\b/i,

  // Asking for more detail about the same subject
  /\bwhat\s+about\s+(?:the\s+)?(?:bass|treble|midrange|soundstage|imaging|dynamics|timing|warmth|detail)\b/i,
  /\bhow\s+(?:do|does)\s+(?:it|they)\s+(?:sound|perform|handle|compare|do|pair|work)\b/i,
  /\bhow\s+(?:is|are)\s+(?:the|its|their)\b/i,
  /\bwhat(?:'s| is)\s+(?:the|its|their)\s+(?:sound|character|strength|weakness|tone)\b/i,
  /\btell\s+me\s+more\b/i,
  /\bmore\s+(?:about|detail|info)\b/i,

  // Pairing / system fit questions referencing prior subject
  /\bwhat\s+(?:amp|dac|speaker|source)\s+(?:pairs?|works?|goes?)\s+(?:well|best)\b/i,
  /\bwhat\s+(?:pairs?|works?|goes?)\s+well\s+with\b/i,
  /\bgood\s+(?:match|pairing|fit)\b/i,
  /\bpair\s+(?:it|them)\s+with\b/i,

  // "What about…" / "And…" / "But…" follow-up patterns
  /^(?:and|but)\s+/i,
  /^what\s+about\b/i,
  /^how\s+about\b/i,
];

/**
 * Check whether a message is a follow-up to an active consultation.
 *
 * Returns true when:
 *   - An active consultation exists, AND
 *   - The message matches a follow-up pattern, OR
 *   - The message contains no new subjects (elliptical reference to prior)
 *
 * Does NOT return true if the message contains new subjects that
 * differ from the active consultation (indicates a topic change).
 */
export function isConsultationFollowUp(
  text: string,
  activeConsultation: { subjects: SubjectMatch[]; originalQuery: string } | undefined,
): boolean {
  if (!activeConsultation) return false;
  if (activeConsultation.subjects.length === 0) return false;

  // Context enrichment — providing system details is a follow-up, not a new topic.
  // Check this BEFORE the new-subject gate because system context often mentions
  // other brands/products (e.g., "my amp is a Shindo" after asking about DeVore).
  if (detectContextEnrichment(text) !== null) {
    return true;
  }

  // Check if message introduces new, unrelated subjects
  const newMatches = extractSubjectMatches(text);
  if (newMatches.length > 0) {
    const activeNames = new Set(
      activeConsultation.subjects.map((s) => s.name.toLowerCase()),
    );
    const hasNewSubject = newMatches.some((m) => !activeNames.has(m.name.toLowerCase()));
    if (hasNewSubject) return false; // Topic changed
  }

  // Check follow-up patterns
  if (CONSULTATION_FOLLOWUP_PATTERNS.some((p) => p.test(text))) {
    return true;
  }

  // Short messages with no subjects and no clear intent are likely follow-ups
  // e.g., "and the bass?" or "in a small room?" — but only if truly short
  if (text.split(/\s+/).length <= 8 && newMatches.length === 0) {
    // Only if it doesn't look like a new topic
    const hasQuestionMark = text.includes('?');
    const hasFollowUpWord = /\b(?:and|but|what|how|also|too)\b/i.test(text);
    if (hasQuestionMark && hasFollowUpWord) return true;
  }

  return false;
}
