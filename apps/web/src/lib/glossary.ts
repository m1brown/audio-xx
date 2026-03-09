/**
 * Audio terminology glossary.
 *
 * Provides short, conversational definitions of audio terms.
 * Detects "what is X?" / "what do you mean by X?" questions
 * and returns structured explanations.
 *
 * Definitions follow the pattern:
 *   term → plain explanation → optional musical example
 *
 * Keep explanations under 25 words. These are orientation aids,
 * not encyclopedia entries.
 */

// ── Types ─────────────────────────────────────────────

export interface GlossaryEntry {
  /** The canonical term (lowercase). */
  term: string;
  /** Alternate phrasings that should match this entry. */
  aliases: string[];
  /** Plain-language explanation (one sentence). */
  explanation: string;
  /** Optional musical example to ground the concept. */
  example?: string;
}

export interface GlossaryResult {
  term: string;
  explanation: string;
  example?: string;
}

// ── Glossary entries ──────────────────────────────────

const GLOSSARY: GlossaryEntry[] = [
  // Timing and rhythm
  {
    term: 'transient attack',
    aliases: ['transient', 'transients', 'attack'],
    explanation: 'How quickly and sharply a note starts — the initial snap or strike.',
    example: 'The crack of a snare drum or the pluck of a guitar string.',
  },
  {
    term: 'leading edge',
    aliases: ['leading edges'],
    explanation: 'The very first moment of a note — how crisp or soft the beginning is.',
    example: 'A piano hammer hitting the string — some systems make it sharp, others round it off.',
  },
  {
    term: 'pace',
    aliases: ['prat', 'pace rhythm and timing'],
    explanation: 'How well a system conveys the speed and momentum of music.',
    example: 'Whether a fast jazz track feels lively and driving, or sluggish and dragging.',
  },
  {
    term: 'rhythmic drive',
    aliases: ['rhythmic engagement', 'drive'],
    explanation: 'How strongly the music\'s timing pulls you along — the sense of forward motion.',
    example: 'A funk bassline that makes you want to move, versus one that just sits there.',
  },
  {
    term: 'elasticity',
    aliases: ['elastic'],
    explanation: 'How well a system handles sudden dynamic shifts — the bounce and spring in the music.',
    example: 'An orchestra going from quiet to loud and back — elastic systems track these shifts naturally.',
  },

  // Tonal qualities
  {
    term: 'tonal density',
    aliases: ['density', 'tonal weight', 'body'],
    explanation: 'How much weight and substance notes carry — thick and full versus thin and light.',
    example: 'A cello that sounds rich and resonant versus one that sounds hollow.',
  },
  {
    term: 'warmth',
    aliases: ['warm'],
    explanation: 'A fuller, rounder quality — more lower-midrange energy, less treble emphasis.',
    example: 'The difference between a cozy vinyl sound and a crisp digital one.',
  },
  {
    term: 'clarity',
    aliases: ['clear', 'transparent', 'transparency'],
    explanation: 'How easily you can hear individual details and separate instruments.',
    example: 'Being able to pick out the second guitar in a dense rock mix.',
  },
  {
    term: 'texture',
    aliases: ['textured', 'micro-texture'],
    explanation: 'The fine-grained surface detail of sounds — roughness, breathiness, grain.',
    example: 'Hearing the rosin on a violin bow, or the breath in a singer\'s voice.',
  },

  // Spatial qualities
  {
    term: 'soundstage',
    aliases: ['sound stage', 'stage'],
    explanation: 'The sense of physical space the music occupies — width, depth, and height.',
    example: 'Whether instruments feel spread across a wide room or bunched in the center.',
  },
  {
    term: 'imaging',
    aliases: ['image'],
    explanation: 'How precisely you can locate each instrument in the stereo picture.',
    example: 'Being able to point to where the drummer sits relative to the vocalist.',
  },
  {
    term: 'air',
    aliases: ['airy', 'airiness'],
    explanation: 'A sense of space and openness around instruments — the opposite of congested.',
    example: 'The room ambience around a live recording — reverb tails, the space between notes.',
  },

  // Comfort and fatigue
  {
    term: 'listening fatigue',
    aliases: ['fatigue', 'fatiguing', 'listener fatigue'],
    explanation: 'When a system becomes tiring to listen to over time — often from treble harshness or compression.',
    example: 'Wanting to turn the volume down after 30 minutes, even though it sounded exciting at first.',
  },
  {
    term: 'glare',
    aliases: ['glary', 'sibilance', 'sibilant'],
    explanation: 'A harsh, bright edge — especially on vocals, cymbals, or high-pitched instruments.',
    example: 'S-sounds in vocals that hiss or sting, or cymbals that sound splashy and metallic.',
  },
  {
    term: 'composure',
    aliases: ['composed'],
    explanation: 'How calm and controlled a system stays during complex or loud passages.',
    example: 'A full orchestra at fortissimo that remains clear and organized instead of turning to mush.',
  },

  // Flow and musicality
  {
    term: 'flow',
    aliases: ['musical flow', 'continuity'],
    explanation: 'How naturally music moves from note to note — a sense of unbroken musical line.',
    example: 'A saxophone solo that feels like one continuous breath rather than a series of separate notes.',
  },
  {
    term: 'musicality',
    aliases: ['musical'],
    explanation: 'How emotionally engaging a system sounds — whether it conveys the feeling of the music.',
    example: 'A sad ballad that actually makes you feel something, versus one that just plays the notes.',
  },
  {
    term: 'engagement',
    aliases: ['engaging'],
    explanation: 'Whether the system holds your attention and makes you want to keep listening.',
    example: 'Finding yourself listening to three more albums when you only meant to hear one.',
  },

  // Architecture / design terms
  {
    term: 'R-2R',
    aliases: ['r2r', 'resistor ladder', 'multibit'],
    explanation: 'A DAC design using a ladder of precision resistors. Often sounds more organic and tonally dense.',
  },
  {
    term: 'delta-sigma',
    aliases: ['delta sigma', 'sigma delta', 'ess sabre', 'akm'],
    explanation: 'The most common DAC design — uses oversampling and noise shaping. Often sounds precise and detailed.',
  },
  {
    term: 'NOS',
    aliases: ['non-oversampling', 'nos dac'],
    explanation: 'A DAC that skips digital filtering. Often sounds smoother and more relaxed, trading some precision for flow.',
  },
  {
    term: 'FPGA',
    aliases: ['fpga dac'],
    explanation: 'A DAC using a programmable chip for custom digital processing. Allows unique filter designs.',
  },

  // Amplification
  {
    term: 'damping factor',
    aliases: ['damping'],
    explanation: 'How tightly an amplifier controls the speaker. Higher damping = tighter bass, lower = looser and more relaxed.',
  },
  {
    term: 'single-ended triode',
    aliases: ['set', 'set amp', '300b', '2a3'],
    explanation: 'A simple tube amplifier design — typically low power but prized for midrange purity and texture.',
  },
  {
    term: 'feedback',
    aliases: ['negative feedback', 'zero feedback'],
    explanation: 'A circuit technique that trades some naturalness for lower distortion and tighter control.',
  },
];

// ── Question detection ────────────────────────────────

const QUESTION_PATTERNS = [
  /what (?:is|are|does) (?:a |an |the )?(.+?)(?:\?|$)/i,
  /what do you mean by (.+?)(?:\?|$)/i,
  /what(?:'s| is) (.+?) (?:mean|in audio)(?:\?|$)/i,
  /explain (.+?)(?:\?|$)/i,
  /define (.+?)(?:\?|$)/i,
  /what(?:'s| is) meant by (.+?)(?:\?|$)/i,
  /can you explain (.+?)(?:\?|$)/i,
  /tell me (?:about|what) (.+?) (?:means?|is)(?:\?|$)/i,
];

/**
 * Check if the user's most recent message is asking for a term explanation.
 * Returns a GlossaryResult if a match is found, null otherwise.
 *
 * Only checks the most recent user message (not concatenated history)
 * to avoid false matches on earlier text.
 */
export function checkGlossaryQuestion(currentMessage: string): GlossaryResult | null {
  const lower = currentMessage.toLowerCase().trim();

  for (const pattern of QUESTION_PATTERNS) {
    const match = lower.match(pattern);
    if (!match) continue;

    const queried = match[1].trim().replace(/[?.!,]+$/, '');
    const entry = findEntry(queried);
    if (entry) {
      return {
        term: entry.term,
        explanation: entry.explanation,
        example: entry.example,
      };
    }
  }

  return null;
}

/**
 * Find a glossary entry by term or alias.
 */
function findEntry(query: string): GlossaryEntry | null {
  const q = query.toLowerCase();

  for (const entry of GLOSSARY) {
    if (entry.term === q) return entry;
    if (entry.aliases.some((a) => a === q)) return entry;
  }

  // Partial match fallback — if query contains a known term
  for (const entry of GLOSSARY) {
    if (q.includes(entry.term)) return entry;
    if (entry.aliases.some((a) => q.includes(a))) return entry;
  }

  return null;
}

/**
 * Look up a term directly (for inline annotation use).
 * Returns a short parenthetical explanation or null.
 */
export function getInlineExplanation(term: string): string | null {
  const entry = findEntry(term);
  if (!entry) return null;
  // Return a short parenthetical — trim to first clause if explanation is long
  const short = entry.explanation.split(' — ')[0];
  return short;
}
