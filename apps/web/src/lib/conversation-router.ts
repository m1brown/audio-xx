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
  /\bassess(?:ment)?\s+(?:of\s+)?(?:my|the|this)\s+(?:current\s+)?(?:system|setup|rig|chain)\b/i,
  /\bevaluat(?:e|ion)\s+(?:of\s+)?(?:my|the|this)\s+(?:current\s+)?(?:system|setup|rig|chain)\b/i,
  /\bwhat\s+do\s+you\s+think\s+(?:of|about)\s+(?:my|this|the)\s+(?:current\s+)?(?:system|setup|rig|chain)\b/i,
  /\bthoughts\s+on\s+(?:my|this|the)\s+(?:current\s+)?(?:system|setup|rig|chain)\b/i,
  /\breview\s+(?:of\s+)?(?:my|the|this)\s+(?:current\s+)?(?:system|setup|rig|chain)\b/i,
  // "how's this system?" / "is this a good setup?" / "is X + Y + Z a good system?"
  /\bhow(?:'s| is)\s+(?:my|this|the)\s+(?:system|setup|chain)\b/i,
  /\bis\s+(?:this|that)\s+(?:a\s+)?(?:good|decent|solid|balanced|well.matched)\s+(?:system|setup|chain|combination|combo|pairing)\b/i,
  /\bis\s+.{5,60}\s+(?:a\s+)?(?:good|decent|solid|balanced|well.matched)\s+(?:system|setup|chain|combination|combo|pairing)\b/i,
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
  /\bsounds?\s+(?:too\s+)?(?:bright|thin|harsh|fatiguing|muddy|dull|veiled|grainy|flat|boring|lifeless|congested|sibilant|dry|sterile|clinical|analytical|cold|hard|brittle|forward|strident|sharp|lean|aggressive)\b/i,
  /\btoo\s+much\s+(?:brightness|treble|bass|warmth|sibilance|glare)\b/i,
  /\b(?:bothers?|annoys?|fatigues?)\s+me\b/i,
  /\blistening\s+fatigue\b/i,
  /\bsomething\s+(?:(?:is|sounds?|feels?)\s+)?(?:off|wrong|missing)\b/i,
  /\blacking\b/i,
  /\bnot\s+(?:enough|happy|satisfied)\b/i,
  // Sensitivity / intolerance language
  /\bsensitive\s+to\s+(?:brightness|harshness|fatigue|glare|sibilance|treble|sharpness)\b/i,
  /\bcan'?t\s+(?:tolerate|stand|handle)\s+(?:brightness|harshness|fatigue|glare|sibilance)\b/i,
  /\bdon'?t\s+want\s+(?:something\s+)?(?:sharp|clinical|harsh|bright|fatiguing|sterile|aggressive)\b/i,
  /\bnot\s+(?:sharp|clinical|harsh|bright|fatiguing|sterile|aggressive)\b/i,
  /\bfatiguing\s+(?:over\s+time|quickly|easily|after\b)/i,
  /\bget(?:s)?\s+fatiguing\b/i,
  // Soft-complaint patterns — "a little dry", "can be harsh"
  /\b(?:a\s+(?:little|bit|touch|tad)\s+(?:dry|bright|thin|harsh|lean|cold|sterile|clinical|analytical|hard|forward|fatiguing|aggressive|muddy|dull))\b/i,
  /\b(?:can\s+be|tends?\s+to\s+(?:be|sound)|sometimes?\s+(?:sounds?|feels?|gets?))\s+(?:a\s+(?:little|bit)\s+)?(?:dry|bright|thin|harsh|lean|cold|sterile|clinical|analytical|hard|forward|fatiguing|aggressive|muddy|dull)\b/i,
  /\b(?:great|good|fine|love|enjoy|like)\s+(?:it\s+)?but\s+(?:a\s+(?:little|bit|touch|tad)\s+)?(?:dry|bright|thin|harsh|lean|cold|sterile|clinical|analytical|hard|forward|fatiguing|aggressive|muddy|dull)\b/i,
];

// ── Shopping signals ────────────────────────────────

const SHOPPING_SIGNALS = [
  /\bbest\b/i,
  /\brecommend/i,
  /\blooking\s+for\b/i,
  /\bshould\s+i\s+(?:get|buy)\b/i,
  /\bunder\s+\$?\d/i,
  /\bbudget\b/i,
  /\bwhat\s+(?:dac|amp|speaker|headphone)\b.*\bfor\b/i,
  /\b(?:i\s+)?want\s+(?:a|an)\s+(?:dac|amp|amplifier|speaker|speakers|headphones?|turntable|streamer)\b/i,
  /\b(?:i\s+)?need\s+(?:a|an)\s+(?:dac|amp|amplifier|speaker|speakers|headphones?|turntable|streamer)\b/i,
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

  // 0b. Explicit shopping override — buying intent + product category.
  //     Must fire BEFORE diagnosis so "I want to buy a DAC" isn't caught
  //     by diagnosis patterns like "don't want something harsh".
  //     Only fires when intent is unambiguously shopping (buy/want/need/recommend + category).
  const hasExplicitBuyingIntent = /\b(?:buy|purchase|looking\s+for|want\s+(?:a|an|to\s+buy)|need\s+(?:a|an)|recommend|suggest|shopping\s+for|get\s+(?:a|an|me))\b/i.test(currentMessage);
  const hasProductCategory = /\b(?:dac|amp|amplifier|speaker|speakers|headphones?|turntable|streamer|preamp|preamplifier|subwoofer|cables?|cartridge|phono\s+stage|integrated)\b/i.test(currentMessage);
  if (hasExplicitBuyingIntent && hasProductCategory) {
    return 'shopping';
  }

  // 0c. Budget + category shortcut — "$5k speakers", "speakers under $1000"
  //     When someone states a price and a product type, they're shopping.
  //     Must fire before diagnosis to prevent budget+category inputs from
  //     being misrouted (e.g. "Van Halen $5k speakers").
  const hasBudgetSignal = /\$\s?\d[\d,.]*k?\b|\bunder\s+\$?\d|\bbudget\b/i.test(currentMessage);
  if (hasBudgetSignal && hasProductCategory) {
    return 'shopping';
  }

  // 1. Diagnosis takes priority — listening problem overrides all
  if (DIAGNOSIS_SIGNALS.some((p) => p.test(currentMessage))) {
    return 'diagnosis';
  }

  // 2. Shopping — recommendation request (broader patterns)
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

// ── Domain classification ───────────────────────────
//
// Sits orthogonal to ConversationMode. Where ConversationMode answers
// "what kind of question is this?" (shopping, diagnosis, etc.), DomainClass
// answers "is this a topic the home-audio advisor should answer head-on?"
//
//   core         → standard advisor behavior (no wrapping)
//   adjacent     → live-sound flavor; advisor still answers, but leads with
//                  a short orientation sentence so expectations match output
//   out_of_scope → live-sound territory proper; advisor gives a brief
//                  directional take and points the user to a specialist
//
// Keyword-based detection only — no logic changes downstream. The response
// layer consumes `composeDomainPrefix` / `composeOutOfScopeAnswer` /
// `composeDomainSuffix` to wrap or replace the advisory body.

export type DomainClass = 'core' | 'adjacent' | 'out_of_scope';

/** Adjacent: still answerable by the home-audio advisor, but with framing. */
const ADJACENT_DOMAIN_KEYWORDS: RegExp[] = [
  /\bPA\b/,
  /\broom\s+size\b/i,
  /\bvenue\b/i,
  /\bcoverage\b/i,
];

/** Out-of-scope: live-sound territory; advisor defers to a specialist. */
const OUT_OF_SCOPE_DOMAIN_KEYWORDS: RegExp[] = [
  /\bconcert\b/i,
  /\btour(?:ing)?\b/i,
  /\bline\s+array\b/i,
  /\bfront\s+of\s+house\b/i,
  /\bmonitor\s+wedges?\b/i,
];

/**
 * Classify the home-audio domain fit of a message.
 *
 * Out-of-scope wins over adjacent — "PA system for a concert tour"
 * is out-of-scope, not just adjacent.
 */
export function classifyDomain(message: string): DomainClass {
  if (OUT_OF_SCOPE_DOMAIN_KEYWORDS.some((p) => p.test(message))) {
    return 'out_of_scope';
  }
  if (ADJACENT_DOMAIN_KEYWORDS.some((p) => p.test(message))) {
    return 'adjacent';
  }
  return 'core';
}

// ── Domain response copy ────────────────────────────
//
// Single canonical string per case. No hype, no disclaimers, no apology.

const ADJACENT_PREFIX =
  "This leans more toward live sound, but here's how to think about it.";

const OUT_OF_SCOPE_SUFFIX =
  'For this, a live sound engineer or rental provider will give more precise guidance.';

/**
 * Optional opening sentence to prepend to the advisory body.
 * Returns null for `core` and `out_of_scope` (the latter uses
 * `composeOutOfScopeAnswer` instead of wrapping the engine output).
 */
export function composeDomainPrefix(domainClass: DomainClass): string | null {
  return domainClass === 'adjacent' ? ADJACENT_PREFIX : null;
}

/**
 * Optional closing sentence to append to the advisory body.
 * Currently used only for `out_of_scope` to direct the user to a specialist.
 */
export function composeDomainSuffix(domainClass: DomainClass): string | null {
  return domainClass === 'out_of_scope' ? OUT_OF_SCOPE_SUFFIX : null;
}

/**
 * Brief 1–2 sentence directional take for out-of-scope queries.
 *
 * Replaces the normal advisory body. Keyword-routed so the orientation
 * matches what the user asked about — line-array vs FOH vs touring vs
 * monitor wedges all imply different first-principles framings.
 *
 * Generic fallback covers the case where an OUT_OF_SCOPE keyword fired
 * but no specific subtopic was named.
 */
export function composeOutOfScopeAnswer(message: string): string {
  if (/\bline\s+array\b/i.test(message)) {
    return 'Line arrays are engineered for long-throw, high-SPL coverage of large audiences — a different design goal than home listening, where the priority is tonal balance and intimacy at the seated position.';
  }
  if (/\bfront\s+of\s+house\b/i.test(message)) {
    return 'Front-of-house priorities are coverage, headroom, and crowd-level intelligibility — the tuning approach and the gear stack are different from a domestic listening setup.';
  }
  if (/\bmonitor\s+wedges?\b/i.test(message)) {
    return 'Stage monitors prioritize cut-through clarity at high SPL near the performer — a different optimization than home listening, which targets tonal balance at moderate levels.';
  }
  if (/\btour(?:ing)?\b/i.test(message)) {
    return 'Touring rigs prioritize reliability, repeatable coverage across varied rooms, and SPL headroom — design constraints that diverge from home-listening voicing.';
  }
  if (/\bconcert\b/i.test(message)) {
    return 'Concert-scale reproduction is shaped by venue acoustics, throw distance, and audience coverage — the design priorities differ meaningfully from a domestic listening room.';
  }
  // Generic out-of-scope fallback.
  return 'This sits in live-sound territory, where coverage, throw distance, and SPL headroom drive the design — different priorities from a home listening setup.';
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
