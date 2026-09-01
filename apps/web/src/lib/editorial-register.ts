/**
 * Editorial register — the tone rules for assessment prose.
 *
 * Audio XX should read like an excellent reviewer, not a novelist. The
 * distinction is not "plain vs. vivid"; it is whether a sentence carries
 * information. "The soundstage breathes" and "image space extends beyond
 * the speakers" are the same length. Only the second one tells the reader
 * what they would hear.
 *
 * Two prior guards already exist and are NOT replaced by this module:
 *   - `REVIEWER_REGISTER_RE` (a3-artifact-case.ts) polices LLM-proposed
 *     prose at admission time;
 *   - `validateDominantCharacter` (artifact/canonical.ts) enforces the
 *     one-sentence, no-teleology invariant on that single line.
 * This module covers the gap between them: the deterministic phrase banks
 * that ship on every assessment, which neither guard inspects.
 *
 * The patterns below are deliberately narrow. They name constructions
 * observed in shipped output, not a general vocabulary ban — the catalog
 * layer (technology-profiles, brand tendencies) is editorial voice written
 * by hand and is out of scope. See `editorial-register.test.ts` for the
 * exact set of modules this is enforced against.
 */

export interface RegisterRule {
  id: string;
  /** What the construction fails at, in the terms of the brief. */
  kind: 'anthropomorphism' | 'metaphor' | 'vague-emotional' | 'filler' | 'unfalsifiable';
  re: RegExp;
  /** What to write instead. */
  guidance: string;
}

export const REGISTER_RULES: RegisterRule[] = [
  {
    id: 'breathes',
    kind: 'anthropomorphism',
    re: /\b(breathes?|breathing)\b/i,
    guidance: 'Name the audible behaviour — continuity of phrasing, or image space beyond the speakers.',
  },
  {
    id: 'sings-wheezes',
    kind: 'anthropomorphism',
    re: /\b(sings?|wheezes?|shouts?|growls?)\b/i,
    guidance: 'Describe load behaviour or headroom instead of giving the equipment a voice.',
  },
  {
    id: 'comes-alive',
    kind: 'anthropomorphism',
    re: /\bcomes? alive\b|\bcome alive\b/i,
    guidance: 'State the operating condition — "reaches satisfying levels on modest power".',
  },
  {
    id: 'runs-out-of-voice',
    kind: 'anthropomorphism',
    re: /\bruns? out of voice\b|\bwithout arguing\b|\bnever quite owns it\b|\bbear down\b/i,
    guidance: 'Say which limit is reached, and whose.',
  },
  {
    id: 'two-perspectives',
    kind: 'metaphor',
    re: /\btwo perspectives in one room\b|\bthe final word\b|\bveil (?:is )?lifted\b|\bmusical tapestry\b/i,
    guidance: 'Describe what stays separately audible, or which stage sets the result.',
  },
  {
    id: 'romance-vocabulary',
    kind: 'vague-emotional',
    re: /\b(magical|intoxicating|seductive|seduces?|romance|soulful|sweet(?:ness)?|luscious|sublime)\b/i,
    guidance: 'Replace with the measurable or reliably audible property being pointed at.',
  },
  {
    id: 'conversational-filler',
    kind: 'filler',
    re: /\bthat['’]s the deal\b|\bbe honest about\b|\bat the end of the day\b/i,
    guidance: 'State the trade-off directly; do not address the reader’s character.',
  },
  {
    id: 'could-describe-anything',
    kind: 'unfalsifiable',
    re: /\bdeliberate synergy\b|\ba considered balance\b|\bone clear character\b|\bsonic experience\b/i,
    guidance: 'A sentence that fits every competent system carries no information. Name the levels or the axis.',
  },
];

export interface RegisterViolation {
  rule: RegisterRule;
  match: string;
}

/** Every register rule the text violates. Empty array = clean. */
export function findRegisterViolations(text: string | undefined | null): RegisterViolation[] {
  const t = (text ?? '').trim();
  if (!t) return [];
  const out: RegisterViolation[] = [];
  for (const rule of REGISTER_RULES) {
    const m = t.match(rule.re);
    if (m) out.push({ rule, match: m[0] });
  }
  return out;
}

/**
 * The three questions every assessment must answer, per the editorial
 * brief. Exported so the assessment tests can assert coverage across the
 * whole document rather than section by section — the Dominant Character
 * line answers only the first, and is barred by its own invariant from
 * answering the second.
 */
export const ASSESSMENT_QUESTIONS = [
  'What is the dominant character?',
  'Why does the system behave this way?',
  'What consequence does that have for the listener?',
] as const;
