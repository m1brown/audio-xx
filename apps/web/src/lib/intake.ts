/**
 * Guided intake flow for new or vague entry queries.
 *
 * Detects underspecified requests like "I want a new stereo",
 * "help me get started", "I need speakers" and generates a structured
 * set of intake questions to gather context before routing to the
 * shopping or consultation engine.
 *
 * Questions cover:
 *   1. Scope — whole system vs single component
 *   2. Budget
 *   3. Room / listening environment
 *   4. How they listen (critical listening, background, late night, etc.)
 *   5. Genres and music preferences
 *   6. Audio preference / sonic character (if they have one)
 */

// ── Intake detection patterns ────────────────────────

/**
 * Patterns that indicate an underspecified "I want gear" request.
 * These fire BEFORE shopping patterns because they lack the specificity
 * needed for the shopping engine to produce useful output.
 */
const INTAKE_PATTERNS = [
  // Direct desire for a system / setup
  /\b(?:i\s+)?want\s+(?:a\s+)?(?:new\s+)?(?:stereo|system|setup|hifi|hi-fi|audio\s+system)\b/i,
  /\b(?:i\s+)?need\s+(?:a\s+)?(?:new\s+)?(?:stereo|system|setup|hifi|hi-fi|audio\s+system)\b/i,
  /\b(?:i\s+)?(?:want|need)\s+(?:to\s+)?(?:get|buy)\s+(?:a\s+)?(?:new\s+)?(?:stereo|system|setup|hifi|hi-fi)\b/i,

  // Getting started / new to audio
  /\b(?:getting|get)\s+(?:started|into)\s+(?:with\s+)?(?:audio|hifi|hi-fi|vinyl|streaming)\b/i,
  /\b(?:new\s+to|just\s+starting)\s+(?:audio|hifi|hi-fi|the\s+hobby|this)\b/i,
  /\bfirst\s+(?:real\s+)?(?:stereo|system|setup|hifi|hi-fi)\b/i,
  /\b(?:help|want)\s+(?:me\s+)?(?:get|set)\s+(?:up|started)\b/i,

  // Vague category desire without specificity
  /\b(?:i\s+)?want\s+(?:a\s+)?(?:some\s+)?(?:new\s+)?(?:speakers?|headphones?(?:\s+setup)?|dac|amp|amplifier|turntable)\b/i,
  /\b(?:i\s+)?need\s+(?:a\s+)?(?:some\s+)?(?:new\s+)?(?:speakers?|headphones?(?:\s+setup)?|dac|amp|amplifier|turntable)\b/i,
  /\blooking\s+for\s+(?:a\s+)?(?:new\s+)?(?:stereo|system|setup|speakers?|headphones?)\b/i,

  // Open-ended audio desire
  /\b(?:i\s+)?want\s+(?:to\s+)?(?:listen\s+to\s+)?(?:better|good|great|nice)\s+(?:sound|music|audio)\b/i,
  /\bwant\s+(?:a\s+)?(?:better|good|great|nice)\s+(?:listening|music|audio)\s+(?:experience|setup)\b/i,

  // Home theater / multi-use
  /\b(?:i\s+)?(?:want|need)\s+(?:a\s+)?(?:home\s+theater|home\s+theatre|surround|music\s+system)\b/i,
];

/**
 * Guard patterns — when present alongside intake patterns, the query
 * has enough specificity to skip intake and go straight to shopping.
 *
 * Philosophy: if the user volunteers ANY concrete context (budget, room,
 * baseline system, use case), they're ready to talk — not fill out a form.
 * A form should only appear when the message is truly bare ("i want a stereo"
 * with nothing else). One signal of specificity is enough to enter a
 * conversational flow where the system can ask follow-ups naturally.
 *
 * See Case 001: "i'd like a stereo. my budget is 1500. i'm used to sonos
 * but i want something a little better, with a turntable too" — that single
 * message contains budget, baseline, intent, and taste signal. A form would
 * have blocked a more productive conversation.
 */
const INTAKE_GUARD_PATTERNS = [
  // Budget signals
  /\bunder\s+\$\d/i,
  /\$\s?\d{3,}/,
  /\€\s?\d{3,}/,
  /\bbudget\s+(?:of|around|is)\s+\$?\€?\d/i,

  // Room / placement signals
  /\bfor\s+(?:my|a)\s+(?:small|large|medium|tiny|big)\s+room\b/i,
  /\b(?:apartment|flat|bedroom|office|desk|living\s+room|studio)\b/i,
  /\b(?:against|near|close\s+to)\s+(?:the\s+)?wall\b/i,

  // Listening habit signals
  /\b(?:i\s+)?listen\s+to\s+(?:mostly|mainly|a\s+lot\s+of)\b/i,
  /\b(?:jazz|classical|rock|electronic|hip.hop|vinyl|streaming)\b/i,

  // Baseline system / upgrade context
  /\b(?:used\s+to|coming\s+from|currently\s+(?:have|use|using)|replacing|upgrading\s+from)\b/i,
  /\b(?:sonos|bose|soundbar|bluetooth\s+speaker|airpods|homepod|echo)\b/i,

  // Use-case / feature signals
  /\b(?:turntable|vinyl|record\s+player|phono)\b/i,
  /\b(?:a\s+little|much|way)\s+better\b/i,
];

/**
 * How many guard signals are needed to bypass intake.
 * A single concrete signal is enough — the conversation can extract the
 * rest naturally. The form should only appear for truly bare queries.
 */
const GUARD_THRESHOLD = 1;

// ── Scope detection ──────────────────────────────────

export type IntakeScope =
  | 'whole_system'
  | 'speakers'
  | 'headphones'
  | 'dac'
  | 'amplifier'
  | 'turntable'
  | 'streamer'
  | 'home_theater'
  | 'unknown';

function detectScope(text: string): IntakeScope {
  const lower = text.toLowerCase();
  if (/\b(?:stereo|system|setup|hifi|hi-fi|audio\s+system|whole|complete|entire|from\s+scratch)\b/i.test(lower)) {
    return 'whole_system';
  }
  if (/\bhome\s+theat(?:er|re)\b|\bsurround\b/i.test(lower)) return 'home_theater';
  if (/\bspeakers?\b/i.test(lower)) return 'speakers';
  if (/\bheadphones?\b|\biems?\b|\bearphones?\b/i.test(lower)) return 'headphones';
  if (/\bdac\b|\bdigital.to.analog\b/i.test(lower)) return 'dac';
  if (/\b(?:amp|amplifier|integrated)\b/i.test(lower)) return 'amplifier';
  if (/\bturntable\b|\brecord\s+player\b|\bvinyl\b/i.test(lower)) return 'turntable';
  if (/\bstreamer\b|\bnetwork\s+player\b/i.test(lower)) return 'streamer';
  return 'unknown';
}

// ── Intake question structure ─────────────────────────

export interface IntakeQuestion {
  /** Short section label (uppercase). */
  label: string;
  /** The question to ask. */
  question: string;
  /** Numbered options (if applicable). */
  options?: string[];
  /** Whether this is a free-form question (no options). */
  freeForm?: boolean;
  /** Whether multiple options can be selected (checkbox vs radio). */
  multiSelect?: boolean;
}

export interface IntakeResponse {
  /** Warm opening acknowledgement. */
  greeting: string;
  /** Detected scope (may be 'unknown'). */
  scope: IntakeScope;
  /** Structured intake questions. */
  questions: IntakeQuestion[];
}

// ── Scope labels ─────────────────────────────────────

const SCOPE_LABELS: Record<IntakeScope, string> = {
  whole_system: 'a complete system',
  speakers: 'speakers',
  headphones: 'headphones',
  dac: 'a DAC',
  amplifier: 'an amplifier',
  turntable: 'a turntable setup',
  streamer: 'a streamer',
  home_theater: 'a home theater setup',
  unknown: 'audio gear',
};

// ── Public API ───────────────────────────────────────

/**
 * Returns true if the message looks like an underspecified entry query
 * that should trigger the guided intake flow.
 */
export function isIntakeQuery(text: string, subjectCount: number): boolean {
  // Must match an intake pattern
  if (!INTAKE_PATTERNS.some((p) => p.test(text))) return false;

  // If the user named specific products/brands, they're past intake
  if (subjectCount >= 2) return false;

  // Check guard signals — if enough specificity is present, skip intake
  const guardCount = INTAKE_GUARD_PATTERNS.filter((p) => p.test(text)).length;
  if (guardCount >= GUARD_THRESHOLD) return false;

  return true;
}

/**
 * Build the structured intake response with all questions.
 */
export function buildIntakeResponse(text: string): IntakeResponse {
  const scope = detectScope(text);

  // ── Greeting ──
  let greeting: string;
  if (scope === 'unknown') {
    greeting = 'Great — I can help with that. To point you in the right direction, it helps to understand a few things about how you listen and what you\'re looking for.';
  } else {
    greeting = `Great — ${SCOPE_LABELS[scope]} is a good place to focus. To give you useful guidance rather than a generic list, it helps to understand a few things first.`;
  }

  // ── Questions ──
  const questions: IntakeQuestion[] = [];

  // 1. Scope (only if unknown or whole_system — specific categories skip this)
  if (scope === 'unknown') {
    questions.push({
      label: 'WHAT ARE YOU LOOKING FOR?',
      question: 'Are you thinking about a whole system or a specific component?',
      options: [
        'A complete stereo system (source, amplification, speakers)',
        'A specific component (DAC, amplifier, speakers, turntable, etc.)',
        'Headphone setup (DAC, amp, headphones)',
        'Home theater / multi-channel',
        'Not sure yet — just exploring',
      ],
    });
  } else if (scope === 'whole_system') {
    questions.push({
      label: 'SYSTEM TYPE',
      question: 'What kind of system are you building?',
      options: [
        'Two-channel stereo (speakers)',
        'Headphone-focused',
        'Desktop / near-field',
        'Vinyl-based (turntable + phono stage)',
        'Streaming-based (network player or computer)',
        'Mixed — both speakers and headphones',
      ],
    });
  }

  // 2. Budget
  questions.push({
    label: 'BUDGET',
    question: scope === 'whole_system' || scope === 'unknown'
      ? 'What\'s your total budget for the system?'
      : `What\'s your budget for ${SCOPE_LABELS[scope]}?`,
    options: [
      'Under $500',
      '$500 – $1,000',
      '$1,000 – $2,500',
      '$2,500 – $5,000',
      '$5,000 – $10,000',
      'Over $10,000',
      'Flexible — depends on what makes sense',
    ],
  });

  // 3. Room / environment
  if (scope !== 'headphones') {
    questions.push({
      label: 'ROOM',
      question: 'What\'s your listening space like?',
      options: [
        'Small room or desk / near-field (under 120 sq ft)',
        'Medium room (120–250 sq ft)',
        'Large or open-plan room (over 250 sq ft)',
        'Shared space (living room, kitchen)',
        'Dedicated listening room',
        'Not sure — haven\'t set it up yet',
      ],
    });
  }

  // 4. How they listen
  questions.push({
    label: 'HOW YOU LISTEN',
    question: 'How do you typically listen to music?',
    multiSelect: true,
    options: [
      'Focused / critical listening — sitting down, paying attention',
      'Background listening — music while working, cooking, socializing',
      'Late-night / low-volume listening',
      'Loud and immersive — I like to feel it',
      'A mix of everything depending on mood',
    ],
  });

  // 5. Genres and music preferences
  questions.push({
    label: 'MUSIC',
    question: 'What kind of music do you listen to most?',
    multiSelect: true,
    options: [
      'Jazz, acoustic, vocal — intimate recordings',
      'Classical, orchestral — dynamic range and scale',
      'Rock, indie, alternative — energy and guitars',
      'Electronic, hip-hop, pop — bass and production',
      'Everything — wide range, no single genre dominates',
      'Something else (tell me)',
    ],
  });

  // 6. Audio preference / sonic character
  questions.push({
    label: 'SOUND PREFERENCE',
    question: 'Do you have a sense of what you\'d like it to sound like? Don\'t worry if you\'re not sure — that\'s completely fine.',
    options: [
      'Warm and rich — full-bodied, easy to listen to for hours',
      'Detailed and precise — I want to hear everything in the recording',
      'Punchy and rhythmic — energy, drive, foot-tapping engagement',
      'Spacious and open — wide soundstage, instruments clearly placed',
      'Natural and balanced — nothing exaggerated, just music',
      'I don\'t really know yet — help me figure it out',
    ],
  });

  return { greeting, scope, questions };
}

/**
 * Convert an IntakeResponse into an AdvisoryResponse for the unified renderer.
 */
export function intakeToAdvisory(intake: IntakeResponse): import('./advisory-response').AdvisoryResponse {
  const scopeLabel = intake.scope === 'unknown' ? 'audio' : SCOPE_LABELS[intake.scope];

  return {
    kind: 'intake',
    subject: `getting started — ${scopeLabel}`,
    philosophy: intake.greeting,
    intakeQuestions: intake.questions,
    followUp: 'Answer whichever questions feel relevant — or skip this entirely and just tell me what you\'re looking for in your own words. Even a sentence or two gives me enough to start.',
  };
}
