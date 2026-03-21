/**
 * Conversation router — classifies user input into a conversation mode
 * before detailed intent detection runs.
 *
 * Modes:
 *   consultation — brand/technology/philosophy questions (answer first, then optionally ask)
 *   diagnosis    — user describes a listening problem or system symptom
 *   shopping     — user wants product recommendations
 *   inquiry      — user asks about a specific product's fit or character
 *
 * The router sits upstream of detectIntent(). It determines which
 * reasoning path the engine should use. Once a mode is established,
 * it persists across turns unless the user clearly shifts topic.
 *
 * Consultation is the key new path: questions like "What is Shindo known for?"
 * or "How do horn speakers sound?" should produce a concise domain-knowledge
 * answer, not trigger diagnostic logic or product scoring.
 */

// ── Mode type ───────────────────────────────────────

export type ConversationMode =
  | 'consultation'
  | 'diagnosis'
  | 'shopping'
  | 'inquiry';

// ── Consultation patterns ───────────────────────────
//
// These detect questions about brands, technologies, design philosophies,
// or general audio knowledge where the user is seeking understanding,
// not a product recommendation or system diagnosis.

const CONSULTATION_PATTERNS = [
  // Brand / maker knowledge
  /\bwhat\s+(?:is|are)\s+\w+\s+known\s+for\b/i,
  /\bwhat\s+(?:does|do)\s+\w+\s+(?:make|build|design|specialize)\b/i,
  /\btell\s+me\s+about\s+(?:the\s+)?(?:\w+\s+)?(?:brand|company|house sound|design philosophy)\b/i,
  /\bwhat(?:'s| is)\s+(?:the\s+)?(?:\w+\s+)?house\s+sound\b/i,
  // "describe X", "tell me about X speakers/dacs/amps"
  /\bdescribe\s+\w+/i,
  /\btell\s+me\s+about\s+\w+/i,

  // Technology / topology knowledge
  /\bwhat\s+(?:is|are)\s+(?:a\s+|an\s+)?(?:r-?2r|delta[- ]sigma|nos|fpga|multibit|horn[- ]loaded|sealed[- ]box|bass[- ]reflex|ported|open[- ]baffle)\b/i,
  /\bhow\s+(?:does|do)\s+(?:a\s+|an\s+)?(?:r-?2r|delta[- ]sigma|nos|fpga|multibit|tube|horn|sealed|ported)\s+(?:\w+\s+)?(?:work|sound|differ|compare)\b/i,
  /\bdifference\s+between\s+(?:r-?2r|delta[- ]sigma|nos|fpga|multibit|tube|horn|sealed|ported)\s+and\b/i,
  /\b(?:r-?2r|delta[- ]sigma|nos|fpga|multibit)\s+vs\.?\s+(?:r-?2r|delta[- ]sigma|nos|fpga|multibit)\b/i,

  // General design philosophy / audio knowledge
  /\bhow\s+(?:does|do)\s+(?:horn|tube|planar|electrostatic|ribbon|open[- ]baffle)\s+speakers?\s+sound\b/i,
  /\bwhat\s+(?:kind|type|style)\s+of\s+(?:sound|presentation|character)\b/i,
  /\bexplain\s+(?:the\s+)?(?:difference|concept|idea|approach)\b/i,
  /\bwhat\s+(?:is|are)\s+(?:the\s+)?(?:pros?\s+and\s+cons?|advantages?|disadvantages?|trade-?offs?)\s+of\b/i,
  /\bwhy\s+(?:do|would)\s+(?:some\s+)?(?:people|listeners|audiophiles)\s+(?:prefer|choose|like)\b/i,
  /\bwhat\s+makes\s+\w+\s+(?:different|special|unique)\b/i,
];

// ── System assessment patterns ───────────────────────
// These detect system-level evaluation requests. Must be checked before
// diagnosis because "assessment of my system" contains "my system".

const SYSTEM_ASSESSMENT_SIGNALS = [
  /\bassess(?:ment)?\s+(?:of\s+)?(?:my|the)\s+(?:current\s+)?(?:system|setup|rig|chain)\b/i,
  /\bevaluat(?:e|ion)\s+(?:of\s+)?(?:my|the)\s+(?:current\s+)?(?:system|setup|rig|chain)\b/i,
  /\bwhat\s+do\s+you\s+think\s+(?:of|about)\s+my\s+(?:current\s+)?(?:system|setup|rig|chain)\b/i,
  /\bthoughts\s+on\s+my\s+(?:current\s+)?(?:system|setup|rig|chain)\b/i,
  /\breview\s+(?:of\s+)?my\s+(?:current\s+)?(?:system|setup|rig|chain)\b/i,
  /\bsuggestions?\s+(?:on|for)\s+(?:areas?\s+to\s+)?(?:upgrade|improve)\b/i,
  /\bhelp\s+(?:me\s+)?(?:improve|upgrade)\s+(?:my\s+)?(?:system|setup)\b/i,
  /\bwhat\s+(?:should|would|could)\s+i\s+(?:upgrade|improve|change)\b/i,
  /\bareas?\s+to\s+(?:upgrade|improve|focus\s+on)\b/i,
  /\bnext\s+(?:step|upgrade|move)\s+for\s+(?:my\s+)?(?:system|setup)\b/i,
  // Restraint / do-nothing queries — user asks whether changing is necessary at all
  /\bcase\s+for\s+(?:doing\s+)?nothing\b/i,
  /\bshould\s+i\s+(?:just\s+)?(?:wait|hold|stay|keep)\b/i,
  /\bmaybe\s+i\s+should(?:n'?t)?\s+change\b/i,
  /\breason\s+not\s+to\s+(?:change|upgrade)\b/i,
  /\bkeep\s+(?:my\s+)?(?:system|setup|chain)\s+as\s+is\b/i,
  /\bdon'?t\s+(?:need\s+to\s+)?change\s+anything\b/i,
];

// ── Cable signals ─────────────────────────────────────
// Cable queries should route to consultation, not shopping.

const CABLE_SIGNALS = [
  /\bspeaker\s+cables?\b/i,
  /\brca\s+cables?\b/i,
  /\binterconnects?\b/i,
  /\bpower\s+(?:cord|cable)s?\b/i,
  /\bcabling\b/i,
  /\bcable\s+(?:recommendation|suggestion|advice|upgrade)\b/i,
];

// ── Diagnosis patterns (imported concept from intent.ts) ─

const DIAGNOSIS_SIGNALS = [
  /\bmy\s+(?:system|setup|rig)\b/i,
  /\bsounds?\s+(?:too\s+)?(?:bright|thin|harsh|fatiguing|muddy|dull|veiled|grainy|flat|boring|lifeless|congested|sibilant)\b/i,
  /\btoo\s+much\s+(?:brightness|treble|bass|warmth|sibilance|glare)\b/i,
  /\b(?:bothers?|annoys?|fatigues?)\s+me\b/i,
  /\blistening\s+fatigue\b/i,
  /\bsomething\s+(?:is\s+)?(?:off|wrong|missing)\b/i,
  /\blacking\b/i,
  /\bnot\s+(?:enough|happy|satisfied)\b/i,
  // Sensitivity / intolerance language — "sensitive to brightness", "can't tolerate harshness"
  /\bsensitive\s+to\s+(?:brightness|harshness|fatigue|glare|sibilance|treble|sharpness)\b/i,
  /\bcan'?t\s+(?:tolerate|stand|handle)\s+(?:brightness|harshness|fatigue|glare|sibilance)\b/i,
  /\bdon'?t\s+want\s+(?:something\s+)?(?:sharp|clinical|harsh|bright|fatiguing|sterile|aggressive)\b/i,
  /\bnot\s+(?:sharp|clinical|harsh|bright|fatiguing|sterile|aggressive)\b/i,
  /\bfatiguing\s+(?:over\s+time|quickly|easily|after\b)/i,
  /\bget(?:s)?\s+fatiguing\b/i,
];

// ── Shopping signals ────────────────────────────────

const SHOPPING_SIGNALS = [
  /\bbest\b/i,
  /\brecommend/i,
  /\blooking\s+for\b/i,
  /\bshould\s+i\s+(?:get|buy)\b/i,
  /\bunder\s+\$\d/i,
  /\bbudget\b/i,
  /\bwhat\s+(?:dac|amp|speaker|headphone)\b.*\bfor\b/i,
];

// ── Hypothetical / counterfactual signals ─────────────
// User introduces a hypothetical system modification or asks about
// a component they don't own yet. Routes to consultation so the
// advisory engine can reason from architecture and taste context.

const HYPOTHETICAL_SIGNALS = [
  /\blet'?s\s+say\b/i,
  /\bsuppose\s+(?:i|we|you)\b/i,
  /\bwhat\s+if\s+(?:i|we|my)\b/i,
  /\bimagine\s+(?:i|we)\b/i,
  /\bhypothetically\b/i,
  /\bwhat\s+(?:would|could)\s+(?:happen|change)\s+if\b/i,
  /\bhow\s+would\s+(?:that|it|a|an|the)\s+(?:change|affect|alter|shift|modify)\b/i,
  /\bif\s+i\s+(?:replaced|swapped|switched|added|used|had)\b/i,
  /\bwould\s+(?:a|an)\s+(?:tube|solid[- ]state|class[- ]?a|set|push[- ]pull|r2r|fpga|horn|planar)\b/i,
];

// ── Meta / capability signals ─────────────────────────
// User asks about the system's own capabilities, limitations, or
// how it handles unknown products. Routes to consultation so the
// advisory engine can produce a transparent self-description.

const META_SIGNALS = [
  /\bnot\s+in\s+(?:your|the)\s+(?:database|catalog|system)\b/i,
  /\bdon'?t\s+(?:have|know)\s+(?:that|this|a)\s+(?:product|brand|model)\b/i,
  /\bhow\s+(?:do|would)\s+you\s+handle\b/i,
  /\bwhat\s+if\s+you\s+don'?t\s+(?:know|have|recogni[sz]e)\b/i,
  /\bcan\s+you\s+handle\b/i,
  /\bwhat\s+are\s+your\s+(?:limits|limitations|capabilities)\b/i,
  /\bhow\s+(?:do\s+you|does\s+(?:this|the\s+system))\s+work\b/i,
  /\bwhat\s+(?:do\s+you|can\s+you)\s+(?:actually\s+)?(?:know|cover|have\s+data)\b/i,
  /\bisn'?t\s+in\s+your\b/i,
];

// ── Router ──────────────────────────────────────────

/**
 * Classify the user's current message into a conversation mode.
 *
 * Priority:
 *   1. Diagnosis — explicit system problem overrides everything
 *   2. Shopping — product recommendation request
 *   3. Consultation — brand/technology/philosophy knowledge
 *   4. Inquiry — fallback for gear mentions without problem context
 *
 * Consultation is checked after diagnosis and shopping because:
 *   - "My system sounds thin" + brand mention = diagnosis, not consultation
 *   - "Best R2R DAC under $1000" = shopping, not consultation about R2R
 */
export function routeConversation(currentMessage: string): ConversationMode {
  // 0. System assessment — user asks for evaluation of their system.
  //    Must fire before diagnosis because "my system" triggers DIAGNOSIS_SIGNALS.
  //    Routes to consultation mode so the assessment builder handles it.
  if (SYSTEM_ASSESSMENT_SIGNALS.some((p) => p.test(currentMessage))) {
    return 'consultation';
  }

  // 1. Diagnosis takes priority — listening problem overrides all
  if (DIAGNOSIS_SIGNALS.some((p) => p.test(currentMessage))) {
    return 'diagnosis';
  }

  // 2. Shopping — recommendation request
  if (SHOPPING_SIGNALS.some((p) => p.test(currentMessage))) {
    return 'shopping';
  }

  // 2b. Hypothetical / counterfactual — user introduces a hypothetical
  //     system change. Must fire before cable and consultation to catch
  //     "what if I had a tube amp" before the generic consultation pattern.
  if (HYPOTHETICAL_SIGNALS.some((p) => p.test(currentMessage))) {
    return 'consultation';
  }

  // 2c. Cable advisory — cable queries go to consultation, not shopping
  if (CABLE_SIGNALS.some((p) => p.test(currentMessage))) {
    return 'consultation';
  }

  // 2d. Meta / capability — user asks about system limitations or behavior.
  //     Routes to consultation so the advisory engine can self-describe.
  if (META_SIGNALS.some((p) => p.test(currentMessage))) {
    return 'consultation';
  }

  // 3. Consultation — knowledge / philosophy questions
  if (CONSULTATION_PATTERNS.some((p) => p.test(currentMessage))) {
    return 'consultation';
  }

  // 4. Default to inquiry (product-specific questions handled downstream)
  return 'inquiry';
}

// ── Mode persistence ────────────────────────────────

/**
 * Resolve the effective conversation mode, taking persistence into account.
 *
 * Rules:
 *   - If the router detects diagnosis, shopping, or consultation → use that
 *     (explicit signal overrides persistence)
 *   - If the router returns inquiry (weak/default) and a prior mode is active,
 *     maintain the prior mode unless the new message clearly belongs elsewhere
 *   - Shopping persistence: once shopping is active, vague follow-ups stay in shopping
 *   - Diagnosis persistence: follow-ups stay in diagnosis unless user shifts
 *   - Consultation does NOT persist — each turn is re-evaluated
 *     (consultation questions tend to be self-contained)
 *
 * @param routedMode   - the mode the router selected for this turn
 * @param priorMode    - the mode from the previous turn (undefined on first turn)
 * @param currentMessage - the user's message text (for tie-breaking)
 */
export function resolveMode(
  routedMode: ConversationMode,
  priorMode: ConversationMode | undefined,
): ConversationMode {
  // Explicit mode detected — always use it
  if (routedMode !== 'inquiry') {
    return routedMode;
  }

  // Router returned the default (inquiry) — check if a prior mode should persist
  if (priorMode === 'shopping' || priorMode === 'diagnosis') {
    // Shopping and diagnosis are sticky — vague follow-ups stay in mode
    return priorMode;
  }

  // No persistence applies — use what the router said
  return routedMode;
}
