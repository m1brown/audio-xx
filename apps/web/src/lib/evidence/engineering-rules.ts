/**
 * AUDIO XX'S OWN ENGINEERING RULES — a separate evidence class.
 *
 * A relational inference has THREE provenances, not two, and conflating them
 * is a D-7 failure that is easy to miss because the sentence reads fine:
 *
 *   quantity A   published by the upstream maker   (ARC: output impedance)
 *   quantity B   published by the downstream maker (input impedance)
 *   RULE         Audio XX's own                    (ten-times loading margin)
 *
 * The product evidence licenses the QUANTITIES. The engineering rule licenses
 * their INTERPRETATION. Neither maker said anything about ten times; that
 * convention is ours, and a reader must never be left thinking Audio Research
 * or Butler supplied it. The threshold therefore lives here as a typed,
 * attributable object rather than as a bare number inside a sentence, so it
 * can be cited, revised, or disputed as what it is — an engineering
 * convention Audio XX has adopted.
 *
 * This is the same discipline the evidence layer already applies to specs:
 * `maker_published` and `third_party_reported` are distinguished because the
 * strength of a claim depends on who is behind it. An Audio XX rule is a third
 * kind of backing, and the weakest of the three: it is a convention, not a
 * measurement, and it describes design practice rather than this pairing.
 */

export type EngineeringRuleId = 'loading_margin';

export interface EngineeringRule {
  id: EngineeringRuleId;
  /** What the rule asserts, in one sentence, attributable to Audio XX. */
  statement: string;
  /** The numeric threshold, kept out of prose so it is revisable in one place. */
  threshold: number;
  /** Why the convention exists — never rendered as a claim about a product. */
  rationale: string;
  /**
   * What the rule explicitly does NOT license, so a caller cannot quietly
   * extend a convention about design practice into a claim about sound.
   */
  doesNotLicense: string;
}

/**
 * The line-level loading convention.
 *
 * A load presenting many times the source's output impedance draws little
 * enough current that the source is not meaningfully worked by it. Ten times
 * is the figure in common engineering use; it is a convention rather than a
 * threshold anything measures, and a pairing below it is not thereby faulty.
 */
export const LOADING_MARGIN: EngineeringRule = {
  id: 'loading_margin',
  statement: 'A line-level load conventionally presents at least ten times the '
    + "source's output impedance.",
  threshold: 10,
  rationale: 'A high-impedance load draws little current from the source, so the '
    + 'source is not meaningfully worked by it.',
  doesNotLicense: 'any claim about audible consequence — that would need the '
    + "source's output impedance across frequency, which a single figure does not "
    + 'describe.',
};

/** Every rule Audio XX applies, for the ledger and for audit. */
export const ENGINEERING_RULES: readonly EngineeringRule[] = [LOADING_MARGIN];

/**
 * A relational inference and the three things that licensed it.
 *
 * Carried so a surface can show provenance without reconstructing it, and so a
 * test can assert that the rule is never attributed to a manufacturer.
 */
export interface RelationalInference {
  /** The upstream quantity and who published it. */
  from: { component: string; label: string; value: string };
  /** The downstream quantity and who published it. */
  to: { component: string; label: string; value: string };
  /** Audio XX's rule that interprets them. Never a maker's. */
  rule: EngineeringRule;
  /** Whether the pairing meets the rule's threshold. */
  meetsThreshold: boolean;
  /** The computed ratio, for display. */
  ratio: number;
}
