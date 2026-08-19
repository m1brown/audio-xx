/**
 * Typed physical quantities, and the bounded rules that combine them.
 *
 * THE DEFECT THIS FIXES. Butler's "Minimum 100 Watts RMS @ 8 Ohms" and Acora's
 * "4 ohm" were both flattened to `power_load` positions. D-12 saw two
 * commensurable premises and licensed REINFORCEMENT, and the assessment told a
 * listener that the amplifier's power "pairs effectively with the Acora
 * QRC-2's 4 ohm impedance, ensuring that the speakers are driven with
 * authority."
 *
 * Every input to that sentence was real, cited and manufacturer-published. The
 * conclusion still does not follow: the power figure is specified INTO 8 OHMS
 * and the loudspeaker is a 4-OHM LOAD. What the amplifier delivers into 4 ohms
 * is unstated, and a hybrid output stage may or may not approach doubling.
 *
 * The representation could not tell "two numbers in the same domain" from "two
 * numbers that combine into a third". A quantity needs its unit and the
 * condition it was measured under, or it is not a quantity — it is a position
 * on an axis wearing a number.
 *
 * DELIBERATELY BOUNDED. Four quantity types and one combining rule, covering
 * the amplifier/loudspeaker cases real assessments actually raise. This is not
 * the beginning of an electroacoustic ontology, and it should not grow without
 * a real case forcing it.
 */

export type PhysicalQuantityType =
  | 'power_output'
  | 'nominal_impedance'
  | 'sensitivity'
  | 'power_handling';

export interface QuantityPremise {
  subject: string;
  quantity: PhysicalQuantityType;
  value: number;
  unit: string;
  /** The manufacturer's own wording of the measurement condition. */
  qualifier?: string;
  /**
   * The load the figure was specified INTO, where the source states one.
   *
   * The single most consequential field here. An amplifier's power is
   * meaningless without it, and its absence is a different state from a
   * mismatch — see `assessDriveCapability`.
   */
  specifiedIntoOhms?: number;
  sourceUrl?: string;
  publication?: string;
}

/** Parse a manufacturer or review value string into a typed quantity. */
export function parseQuantity(
  subject: string,
  field: string,
  raw: string,
  meta: { sourceUrl?: string; publication?: string } = {},
): QuantityPremise | null {
  const text = String(raw ?? '').replace(/[‐-―−]/g, '-');

  const numberBefore = (unitRe: RegExp): number | undefined => {
    const m = new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${unitRe.source}`, 'i').exec(text);
    return m ? Number(m[1]) : undefined;
  };
  // "@ 8 ohms", "into 8 ohms", "8Ω load"
  const intoOhms = (() => {
    const m = /(?:@|at|into)\s*(\d+(?:\.\d+)?)\s*(?:ohms?|Ω)/i.exec(text);
    return m ? Number(m[1]) : undefined;
  })();

  if (field === 'power_output' || field === 'power_handling') {
    const watts = numberBefore(/(?:w\b|watts?)/);
    if (watts == null) return null;
    return {
      subject, quantity: field, value: watts, unit: 'W',
      qualifier: text.trim() || undefined,
      specifiedIntoOhms: intoOhms,
      ...meta,
    };
  }

  if (field === 'impedance' || field === 'nominal_impedance') {
    const ohms = numberBefore(/(?:ohms?|Ω)/);
    if (ohms == null) return null;
    return {
      subject, quantity: 'nominal_impedance', value: ohms, unit: 'Ω',
      qualifier: text.trim() || undefined, ...meta,
    };
  }

  if (field === 'sensitivity') {
    const db = numberBefore(/db/);
    if (db == null) return null;
    return {
      subject, quantity: 'sensitivity', value: db, unit: 'dB',
      qualifier: text.trim() || undefined, ...meta,
    };
  }

  return null;
}

/**
 * Can amplifier drive be established from what is held?
 *
 * The one combining rule. Its whole job is to distinguish three states that
 * the old representation collapsed into one:
 *
 *   assessable    the power figure applies to this load, or carries no load
 *                 qualifier and can be read as a nominal rating
 *   load_mismatch the power figure is explicitly specified into a DIFFERENT
 *                 load than the loudspeaker presents. NOT a constraint and NOT
 *                 a pass — a named gap
 *   incomplete    a required input is missing altogether
 *
 * `load_mismatch` is the Butler/Acora case and the reason this exists.
 *
 * NEVER INFER ACROSS LOADS. A 100W-into-8Ω amplifier may deliver anywhere
 * between 100W and 200W into 4Ω depending on its power supply and output
 * stage, and a hybrid design is exactly where that guess is least safe. The
 * honest output is that drive cannot be established from the held
 * specifications — which is a useful thing to tell a listener, and a specific
 * question worth asking their dealer.
 */
export type DriveAssessment =
  | { status: 'assessable'; watts: number; sensitivityDb: number; intoOhms?: number }
  | {
    status: 'load_mismatch';
    watts: number; specifiedIntoOhms: number; loadOhms: number;
    /** What Audio XX would need in order to close the arithmetic. */
    missing: string;
  }
  | { status: 'incomplete'; missing: string };

export function assessDriveCapability(
  ampPower: QuantityPremise | undefined,
  speakerImpedance: QuantityPremise | undefined,
  speakerSensitivity: QuantityPremise | undefined,
): DriveAssessment {
  if (!ampPower) return { status: 'incomplete', missing: 'amplifier power output' };
  if (!speakerSensitivity) {
    return { status: 'incomplete', missing: 'loudspeaker sensitivity' };
  }

  // An explicitly stated load that differs from the loudspeaker's is the case
  // the whole rule exists for. Absence of a stated load is NOT the same thing:
  // a bare "5 watt SET" is a nominal rating, and refusing to reason from it
  // would discard a fact the listener supplied and leave a real mismatch
  // undiagnosed.
  if (ampPower.specifiedIntoOhms != null
    && speakerImpedance
    && ampPower.specifiedIntoOhms !== speakerImpedance.value) {
    return {
      status: 'load_mismatch',
      watts: ampPower.value,
      specifiedIntoOhms: ampPower.specifiedIntoOhms,
      loadOhms: speakerImpedance.value,
      missing: `${ampPower.subject} output specified into ${speakerImpedance.value}Ω`,
    };
  }

  return {
    status: 'assessable',
    watts: ampPower.value,
    sensitivityDb: speakerSensitivity.value,
    intoOhms: ampPower.specifiedIntoOhms ?? speakerImpedance?.value,
  };
}

/**
 * Are two quantities commensurable — can they combine into a conclusion?
 *
 * Sharing a broad physical domain is not enough. Two power figures do not
 * combine; a power figure and a sensitivity figure do, under the rule above.
 * Being numeric is not a relation.
 */
const COMBINABLE: ReadonlyArray<[PhysicalQuantityType, PhysicalQuantityType]> = [
  ['power_output', 'sensitivity'],
  ['power_output', 'nominal_impedance'],
];

export function quantitiesCombine(
  a: PhysicalQuantityType,
  b: PhysicalQuantityType,
): boolean {
  return COMBINABLE.some(([x, y]) => (a === x && b === y) || (a === y && b === x));
}

/**
 * How safely does an observation transfer from where it was made?
 *
 * A property of the PREMISE, not of any relation — it describes the evidence,
 * not an interaction between two pieces of it.
 *
 *   direct            no stated condition; the observation stands on its own
 *   conditioned       depends on something about THIS product — break-in,
 *                     an input, a mode, a listening level. It still tells the
 *                     listener about their unit, under a stated condition.
 *   transfer_limited  made through OTHER equipment. What was heard may belong
 *                     to the chain rather than to the product, and tonal
 *                     findings travel worst of all.
 *
 * The Acora case: the only published listening account of the QRC-2 was made
 * "driven by Ideon Audio sources and JMF Audio electronics at Capital
 * AudioFest 2022". Its tonal findings transfer weakly to Nathan's chain; its
 * finding that the speaker did not compress at high level travels better,
 * because that is a property of the loudspeaker under level rather than of the
 * partnering electronics.
 */
export type EvidenceTransfer = 'direct' | 'conditioned' | 'transfer_limited';

export function transferFor(conditionKind?: string): EvidenceTransfer {
  if (!conditionKind) return 'direct';
  if (conditionKind === 'associated_equipment') return 'transfer_limited';
  return 'conditioned';
}
