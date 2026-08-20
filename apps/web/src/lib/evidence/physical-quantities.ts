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

/**
 * Parse a published value string into EVERY typed quantity it states.
 *
 * Plural on purpose. A manufacturer routinely publishes a whole power table in
 * one field:
 *
 *   "Minimum 100 Watts RMS @ 8 Ohms; 128 Watts, RMS typical @ 8 Ohms;
 *    200 Watts, RMS typical @ 4 Ohms"
 *
 * A parser that returns the first match reports 100W into 8Ω and silently
 * discards the 4Ω figure — the one figure that answers the question actually
 * being asked about a 4-ohm loudspeaker. That is not caution. The evidence was
 * in hand and got thrown away, and the assessment then reports a gap that does
 * not exist.
 */
export function parseQuantities(
  subject: string,
  field: string,
  raw: string,
  meta: { sourceUrl?: string; publication?: string } = {},
): QuantityPremise[] {
  const text = String(raw ?? '').replace(/[\u2010-\u2015\u2212]/g, '-');
  const base = { subject, ...meta };

  if (field === 'power_output' || field === 'power_handling') {
    const out: QuantityPremise[] = [];

    // Every "<n> watts ... @ <m> ohms" pair the string states. The clause
    // between the two numbers is kept as the qualifier, because "minimum" and
    // "typical" are the difference between a guarantee and an average.
    // "minimum" and "typical" sit on either side of the number depending on the
    // manufacturer, and the difference between a guarantee and an average is
    // exactly what a listener needs, so both sides are captured.
    const paired = /(?:(minimum|maximum|typical|continuous|peak|nominal)\s+)?(\d+(?:\.\d+)?)\s*(?:W\b|watts?)([^;.]{0,40}?)(?:@|at|into)\s*(\d+(?:\.\d+)?)\s*(?:ohms?|\u03a9)/gi;
    for (const m of text.matchAll(paired)) {
      out.push({
        ...base, quantity: field, value: Number(m[2]), unit: 'W',
        qualifier: [m[1], `${m[2]} W`, m[3]].filter(Boolean)
          .join(' ').replace(/[\s,]+/g, ' ').trim(),
        specifiedIntoOhms: Number(m[4]),
      });
    }
    if (out.length > 0) return out;

    // No load stated anywhere. A bare "5 watt SET" is a nominal rating, and
    // refusing it would discard a fact the listener supplied.
    const bare = /(\d+(?:\.\d+)?)\s*(?:W\b|watts?)/i.exec(text);
    if (!bare) return [];
    return [{ ...base, quantity: field, value: Number(bare[1]), unit: 'W',
      qualifier: text.trim() || undefined }];
  }

  if (field === 'impedance' || field === 'nominal_impedance') {
    const m = /(\d+(?:\.\d+)?)\s*(?:ohms?|\u03a9)/i.exec(text);
    if (!m) return [];
    return [{ ...base, quantity: 'nominal_impedance', value: Number(m[1]), unit: '\u03a9',
      qualifier: text.trim() || undefined }];
  }

  if (field === 'sensitivity') {
    const m = /(\d+(?:\.\d+)?)\s*db/i.exec(text);
    if (!m) return [];
    return [{ ...base, quantity: 'sensitivity', value: Number(m[1]), unit: 'dB',
      qualifier: text.trim() || undefined }];
  }

  return [];
}

/** The first quantity a string states, where callers want just one. */
export function parseQuantity(
  subject: string,
  field: string,
  raw: string,
  meta: { sourceUrl?: string; publication?: string } = {},
): QuantityPremise | null {
  return parseQuantities(subject, field, raw, meta)[0] ?? null;
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
  /** A power figure applies to this load, and sensitivity is known. */
  | { status: 'assessable'; watts: number; sensitivityDb: number; intoOhms?: number;
    qualifier?: string }
  /** Power is published, but only into loads this loudspeaker does not present. */
  | {
    status: 'load_mismatch';
    watts: number; specifiedIntoOhms: number; loadOhms: number;
    /** What Audio XX would need in order to close the arithmetic. */
    missing: string;
  }
  /**
   * A required input is missing. Carries whatever WAS established, because
   * "we know the output at your speaker's load but not its sensitivity" is a
   * different and far more useful thing to say than "not established".
   */
  | { status: 'incomplete'; missing: string; watts?: number; intoOhms?: number;
    qualifier?: string };

/**
 * Choose the power figure that applies to a given load.
 *
 * Where a manufacturer publishes several figures for the same load — a
 * "minimum" and a "typical" — the LOWEST is selected. A minimum is a guarantee
 * and a typical is an average, and a claim about a listener's own unit should
 * rest on the guarantee.
 */
export function powerForLoad(
  powers: QuantityPremise[],
  loadOhms: number | undefined,
): QuantityPremise | undefined {
  const lowest = (xs: QuantityPremise[]) =>
    xs.slice().sort((x, y) => x.value - y.value)[0];

  if (loadOhms != null) {
    const exact = powers.filter((p) => p.specifiedIntoOhms === loadOhms);
    if (exact.length > 0) return lowest(exact);
  }
  const unqualified = powers.filter((p) => p.specifiedIntoOhms == null);
  if (unqualified.length > 0) return lowest(unqualified);
  return undefined;
}

export function assessDriveCapability(
  ampPower: QuantityPremise | QuantityPremise[] | undefined,
  speakerImpedance: QuantityPremise | undefined,
  speakerSensitivity: QuantityPremise | undefined,
): DriveAssessment {
  const powers = (Array.isArray(ampPower) ? ampPower : ampPower ? [ampPower] : [])
    .filter((p) => p.quantity === 'power_output');
  if (powers.length === 0) return { status: 'incomplete', missing: 'amplifier power output' };

  const load = speakerImpedance?.value;
  const applicable = powerForLoad(powers, load);

  // Every published figure is specified into some OTHER load. This is the
  // Butler/Acora case as it was originally reported, and the reason the rule
  // exists: what the amplifier delivers into this load is simply unstated.
  //
  // NEVER INFER ACROSS LOADS. A 100W-into-8Ω amplifier may deliver anywhere
  // between 100W and 200W into 4Ω depending on its supply and output stage,
  // and a hybrid design is where that guess is least safe.
  if (!applicable) {
    const nearest = powers[0];
    return {
      status: 'load_mismatch',
      watts: nearest.value,
      specifiedIntoOhms: nearest.specifiedIntoOhms as number,
      loadOhms: load as number,
      missing: `${nearest.subject} output specified into ${load}\u03a9`,
    };
  }

  if (!speakerSensitivity) {
    return {
      status: 'incomplete', missing: 'loudspeaker sensitivity',
      watts: applicable.value, intoOhms: applicable.specifiedIntoOhms,
      qualifier: applicable.qualifier,
    };
  }

  return {
    status: 'assessable',
    watts: applicable.value,
    sensitivityDb: speakerSensitivity.value,
    intoOhms: applicable.specifiedIntoOhms ?? load,
    qualifier: applicable.qualifier,
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

/**
 * Audio XX's own sentence for a drive conclusion.
 *
 * Written here, by the rule that owns the figures, rather than requested from
 * the model. Three attempts at instructing the model to state this — permitted,
 * then required, then required in capitals — produced three assessments that
 * said nothing about power at all, because generic tonal prose is the cheaper
 * output and the model will always reach for it.
 *
 * Prompting was the wrong instrument. This conclusion was DERIVED, not
 * inferred: the figures are published, the load is published, and the rule
 * combining them is ours. Nothing about it needs a language model, and asking
 * one to repeat a fact we already hold only introduces a way to lose it.
 */
export interface DriveConclusion {
  /** Audio XX's own prose for the finding. */
  sentence: string;
  /**
   * The specific unpublished figure that would resolve what is still open,
   * phrased for use inside another sentence.
   *
   * Promoted out of the prose deliberately. This is the most actionable thing
   * the assessment holds — a named figure, a known owner, and a known unlock —
   * and buried mid-paragraph it read as a caveat rather than as the next step.
   */
  gap?: string;
  /** The question that gap makes worth asking. */
  question?: string;
}

export function driveConclusionFor(
  drive: DriveAssessment,
  ampName: string,
  speakerName: string,
): DriveConclusion | undefined {
  const sentence = driveSentence(drive, ampName, speakerName);
  if (!sentence) return undefined;

  if (drive.status === 'incomplete' && drive.watts != null) {
    return {
      sentence,
      gap: `the ${speakerName}'s sensitivity`,
      // Deliberately about the listener's EXPERIENCE, not about the figure.
      // Asking for a specification is homework; asking whether they are running
      // out of level is a question only they can answer, and their answer
      // decides whether the missing figure matters at all.
      question: 'Are you running into any limit on volume or dynamic range?',
    };
  }

  if (drive.status === 'load_mismatch') {
    return {
      sentence,
      gap: `${ampName}'s output into ${drive.loadOhms} ohms`,
      question: 'How loud do you usually listen, and how large is the room?',
    };
  }

  return { sentence };
}

export function driveSentence(
  drive: DriveAssessment,
  ampName: string,
  speakerName: string,
): string | undefined {
  const ohms = (n: number) => `${n} ohms`;
  // "Published figures put the X at…" rather than "The X publishes…". Product
  // names carry no reliable number — "Monads" is plural, "Rossini Apex" is not
  // — and a template that agrees with its subject cannot be written without
  // knowing which. Sidestepping agreement is not a style choice here.
  const put = (name: string, figure: string) => `Published figures put the ${name} at ${figure}`;

  if (drive.status === 'assessable') {
    return `${put(ampName, `${drive.watts} watts`
      + (drive.intoOhms != null ? ` into ${ohms(drive.intoOhms)}` : ''))}, `
      + `the load the ${speakerName} presents, and the ${speakerName} at `
      + `${drive.sensitivityDb} dB — the pairing is amply powered.`;
  }

  if (drive.status === 'incomplete' && drive.watts != null) {
    // The useful half is stated and the missing half is named precisely.
    // "Drive is unknown" would be false here, and is the failure the whole
    // typed-quantity repair exists to prevent in the other direction.
    return `${put(ampName, `${drive.watts} watts`
      + (drive.intoOhms != null ? ` into ${ohms(drive.intoOhms)}` : ''))}, `
      + `which is the load the ${speakerName} presents, so output at the `
      + `relevant load is established. The ${speakerName}'s sensitivity is not `
      + `published, so the evidence held is not sufficient to estimate this `
      + `system's acoustic headroom reliably.`;
  }

  if (drive.status === 'load_mismatch') {
    return `${put(ampName, `${drive.watts} watts into ${ohms(drive.specifiedIntoOhms)}`)}, `
      + `while the ${speakerName} presents ${ohms(drive.loadOhms)}. What the `
      + `amplifier delivers into ${ohms(drive.loadOhms)} is not published, so `
      + `drive cannot be established from the figures — worth putting to the `
      + `manufacturer directly.`;
  }

  return undefined;
}
