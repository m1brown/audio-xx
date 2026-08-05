/**
 * Post-parse validation for the component chain.
 *
 * Parsed tokens are a hypothesis, not a fact. Before a name is shown to the
 * reader as a component of their system — and before the engine reasons from
 * it — it has to be plausible as a product. Two failures shipped:
 *
 *   "I have KEF LS50 Meta and a Marantz PM6007. Should I upgrade my DAC?"
 *      → component named `Marantz PM6007. Should I`
 *   "Magnepan LRS+ with a Rega Brio integrated amplifier"
 *      → components `Rega` AND a phantom `integrated amplifier`
 *
 * Both put something in the chain banner the user never owned, and the
 * assessment was then computed on that chain. This module is deliberately
 * narrow: it cleans interrogative debris and withholds bare category words.
 * It does not attempt to parse better — that is a separate question.
 */

/** Category nouns that name a KIND of component, never a specific product. */
const BARE_CATEGORY = new Set([
  'amplifier', 'amp', 'integrated amplifier', 'integrated amp', 'integrated',
  'tube amplifier', 'tube amp', 'valve amplifier', 'valve amp',
  'power amplifier', 'power amp', 'preamplifier', 'preamp', 'monoblocks',
  'speaker', 'speakers', 'loudspeaker', 'loudspeakers', 'monitor', 'monitors',
  'dac', 'streamer', 'network streamer', 'source', 'cd player', 'transport',
  'turntable', 'cartridge', 'phono stage', 'phono preamp',
  'headphone', 'headphones', 'headphone amp', 'headphone amplifier',
  'subwoofer', 'sub', 'server', 'receiver', 'system',
]);

/**
 * Trailing interrogative debris. The chain extractor splits on connectors and
 * can carry the rest of the user's sentence into the last segment.
 */
const TRAILING_QUESTION =
  /[.,;:!?]\s*(?:so\s+)?(?:should|shall|would|could|can|do|does|did|is|are|was|were|what|which|how|why|when|where|any|anything|thoughts?|i\b|we\b|my\b)\b.*$/i;

/** A question clause that begins mid-segment without punctuation. */
const TRAILING_QUESTION_BARE =
  /\s+(?:should|would|could)\s+(?:i|we|you)\b.*$/i;

/** Strip interrogative debris from a parsed component name. */
export function cleanComponentName(name: string): string {
  return (name ?? '')
    .replace(TRAILING_QUESTION, '')
    .replace(TRAILING_QUESTION_BARE, '')
    .replace(/\s+/g, ' ')
    .trim()
    // A segment reduced to punctuation is nothing.
    .replace(/^[\s.,;:–—-]+|[\s.,;:–—-]+$/g, '');
}

/**
 * True when the name says only what KIND of thing it is. Such a name may be a
 * genuine but vague mention, or a phantom split off a real component
 * ("Rega Brio integrated amplifier" → "Rega" + "integrated amplifier"). Either
 * way it must not be presented as a product the user owns.
 */
export function isBareCategory(name: string): boolean {
  const n = (name ?? '').toLowerCase().replace(/\s+/g, ' ').trim()
    .replace(/^(?:a|an|the|my)\s+/, '');
  return BARE_CATEGORY.has(n);
}

export interface ChainValidation {
  /** Names safe to display and reason from. */
  names: string[];
  /**
   * Names withheld because they name only a category. Surfaced so the caller
   * can ask about them — withholding must never be silent.
   */
  needsClarification: string[];
}

export function validateChainNames(names: string[]): ChainValidation {
  const out: string[] = [];
  const needsClarification: string[] = [];
  for (const raw of names ?? []) {
    const cleaned = cleanComponentName(raw);
    if (!cleaned) continue;
    if (isBareCategory(cleaned)) {
      if (!needsClarification.includes(cleaned)) needsClarification.push(cleaned);
      continue;
    }
    if (!out.includes(cleaned)) out.push(cleaned);
  }
  return { names: out, needsClarification };
}
