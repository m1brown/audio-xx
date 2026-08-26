/**
 * What a specification MEANS — the quantity, never the product.
 *
 * A dossier that prints "600 ohms" and "47K ohms" has told a reader who
 * already knows what those are exactly nothing new, and told everyone else
 * nothing at all. The figures are the evidence; this is the sentence that
 * lets a listener use them.
 *
 * THE D-7 LINE, AND WHY THIS DOES NOT CROSS IT. Every gloss here explains a
 * QUANTITY — what output impedance is, what sensitivity measures, which way
 * is which. None of them says anything about a product. "Lower output
 * impedance means the component can drive what follows without its own output
 * stage colouring the result" is a fact about electrical engineering that
 * holds for every component ever made; "this DAC sounds uncoloured" is a
 * claim about one product that would need evidence. The first is here. The
 * second never will be.
 *
 * The test is mechanical: if a sentence could be printed unchanged in a
 * textbook, beside any product, it belongs. If it would have to change
 * depending on which box it sat under, it is a character claim wearing an
 * explanation's clothes.
 */

export interface SpecMeaning {
  /** Matches the dossier line's label. */
  match: RegExp;
  /** One sentence. Reads under the figure, not instead of it. */
  meaning: string;
}

/*
 * Ordered: the first match wins, so the specific patterns precede the general
 * ones. "Input impedance" must be tested before "impedance", or a
 * loudspeaker's nominal load and an amplifier's input would get the same gloss
 * and one of them would be wrong.
 */
/*
 * TRIMMED (2026-08-26 editorial pass): frequency response, driver complement,
 * power handling and maximum-output glosses removed. They were textbook-true
 * and appeared under nearly every card, which buried the four glosses that
 * actually carry an interface conclusion. A gloss earns its place by helping
 * the reader use a figure in THIS chain, not by having something accurate to
 * say about it.
 */
export const SPEC_MEANINGS: SpecMeaning[] = [
  {
    match: /input impedance/i,
    meaning: 'How heavily this input loads whatever feeds it. A high figure is an easy '
      + 'load: the component upstream can drive it without its own output stage '
      + 'influencing the result.',
  },
  {
    match: /output impedance/i,
    meaning: 'How firmly this output can drive what follows. A low figure is better, and '
      + 'what matters is the ratio to the next component’s input impedance — roughly '
      + 'ten to one or more is the conventional margin for an interface that stays '
      + 'neutral.',
  },
  {
    match: /minimum load/i,
    meaning: 'The lowest input impedance these outputs are rated to drive. An input above '
      + 'this figure is within specification; one below it asks more of the output '
      + 'stage than the maker warrants.',
  },
  {
    match: /sensitivity for full|input sensitivity/i,
    meaning: 'The input voltage needed to drive this amplifier to full output. Compare it '
      + 'with what the preamplifier actually delivers: much more than this means the '
      + 'volume control will operate low in its range.',
  },
  {
    match: /^sensitivity/i,
    meaning: 'How loud the loudspeaker plays for one watt at one metre. Every 3dB here is '
      + 'worth a doubling of amplifier power, so a sensitive loudspeaker needs far less '
      + 'power for the same level.',
  },
  {
    match: /\bgain\b/i,
    meaning: 'How much this stage multiplies the signal. 6dB is a doubling of voltage; '
      + '12dB is four times.',
  },
  {
    match: /power output/i,
    meaning: 'What the amplifier delivers, at the loads the maker states. The figure that '
      + 'applies is the one at your loudspeaker’s nominal impedance — not the largest '
      + 'number on the list.',
  },
  {
    match: /^impedance/i,
    meaning: 'The nominal load these loudspeakers present. It decides which of an '
      + 'amplifier’s power ratings applies — and it is an average: the real impedance '
      + 'varies with frequency, which is what a full plot would show.',
  },
  {
    match: /tube complement/i,
    meaning: 'Which valves the unit contains. It does not say where in the circuit they '
      + 'sit — a tube-driven stage and a valve output stage are different designs with '
      + 'the same parts list.',
  },
];

/**
 * The gloss for one dossier label, or undefined.
 *
 * Undefined is the common and correct answer. Most labels — dimensions,
 * weight, finish, inputs — need no explanation, and attaching a sentence to
 * every row would bury the ones that earn their place.
 */
export function meaningFor(label: string): string | undefined {
  const l = (label ?? '').trim();
  if (!l) return undefined;
  return SPEC_MEANINGS.find((m) => m.match.test(l))?.meaning;
}
