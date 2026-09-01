/**
 * MAY THESE TWO FIGURES BE COMPARED AT ALL?
 *
 * Evidence compatibility is part of licensing. Two numbers that appear to
 * describe the same property may have been measured under conditions that make
 * arithmetic between them meaningless — and the result looks perfectly
 * reasonable, which is what makes the failure dangerous.
 *
 * THE TRAP THAT PROVED IT. Butler publishes, in one string:
 *
 *   "Minimum 100 Watts RMS @ 8 Ohms; 128 Watts, RMS typical @ 8 Ohms;
 *    200 Watts, RMS typical @ 4 Ohms"
 *
 * Taking the first figure at each load compares a MINIMUM at 8 ohms with a
 * TYPICAL at 4, and reports the amplifier doubling its power. Like-for-like it
 * rises about 1.6×. Nothing about the wrong answer looks wrong.
 *
 * So the check is architectural rather than a fix at one call site: any
 * arithmetic, scaling or relational inference over published quantities passes
 * through `comparable()` first, and a refusal carries the REASON — which the
 * causal-coverage matrix reports as "incompatible evidence conditions" rather
 * than the useless "insufficient evidence".
 *
 * This module decides only whether a comparison is PERMITTED. What the
 * comparison means is the caller's problem, and remains subject to D-7.
 */

/** A published figure with the conditions under which the maker states it. */
export interface ConditionedFigure {
  value: number;
  unit: 'W';
  /** The load the figure was stated at, where one is given. */
  ohms?: number;
  /** Minimum, typical or maximum — never assume when unstated. */
  status: 'minimum' | 'typical' | 'maximum' | 'unstated';
  /** Continuous (RMS) or peak. Comparing across these is meaningless. */
  basis: 'rms' | 'peak' | 'unstated';
  /** The maker's own words, kept so a refusal can quote them. */
  raw: string;
}

const NUM = String.raw`([\d.,]+)`;

/**
 * Read every power figure a maker's string states, each with its conditions.
 *
 * Segments are split on `;` because that is how makers separate distinct
 * measurements. A figure whose status or basis is not stated is recorded as
 * `unstated` — never defaulted to `typical`, because a default is an
 * assumption about a measurement nobody made.
 */
export function readPowerFigures(value: string): ConditionedFigure[] {
  const out: ConditionedFigure[] = [];
  for (const seg of value.split(/;|\band\b/)) {
    const m = new RegExp(`${NUM}\\s*(?:watts?|w)\\b`, 'i').exec(seg);
    if (!m) continue;
    const ohmMatch = /([\d.]+)\s*ohm/i.exec(seg);
    out.push({
      value: Number(m[1].replace(/,/g, '')),
      unit: 'W',
      ohms: ohmMatch ? Number(ohmMatch[1]) : undefined,
      status: /\bminimum\b|\bmin\b/i.test(seg) ? 'minimum'
        : /\btypical\b|\btyp\b/i.test(seg) ? 'typical'
          : /\bmaximum\b|\bmax\b|\bpeak\b/i.test(seg) ? 'maximum' : 'unstated',
      basis: /\brms\b|\bcontinuous\b/i.test(seg) ? 'rms'
        : /\bpeak\b|\bdynamic\b/i.test(seg) ? 'peak' : 'unstated',
      raw: seg.trim(),
    });
  }
  return out;
}

export type Comparability =
  | { ok: true }
  | { ok: false; reason: string };

/**
 * May these two figures be compared?
 *
 * Every material condition must MATCH, or be absent from both. An unstated
 * condition on one side and a stated one on the other is a refusal, not a
 * match: "typical" and "we don't know" are not the same measurement, and
 * treating them as one is precisely the Butler trap.
 */
export function comparable(a: ConditionedFigure, b: ConditionedFigure): Comparability {
  if (a.unit !== b.unit) {
    return { ok: false, reason: `different units (${a.unit} vs ${b.unit})` };
  }
  if (a.status !== b.status) {
    return {
      ok: false,
      reason: `different measurement status — "${a.raw}" is ${a.status}, `
        + `"${b.raw}" is ${b.status}`,
    };
  }
  if (a.basis !== b.basis) {
    return {
      ok: false,
      reason: `different measurement basis — "${a.raw}" is ${a.basis}, `
        + `"${b.raw}" is ${b.basis}`,
    };
  }
  return { ok: true };
}

/**
 * The best like-for-like pair of figures at two different loads.
 *
 * Returns the pair only when their conditions match, and otherwise the reason
 * no comparison was made — so a caller can stay silent for a stated cause
 * rather than silently.
 */
export function pairAcrossLoads(
  figures: ConditionedFigure[],
  lowOhms: number,
  highOhms: number,
): { ok: true; low: ConditionedFigure; high: ConditionedFigure }
  | { ok: false; reason: string } {
  const atLow = figures.filter((f) => f.ohms === lowOhms);
  const atHigh = figures.filter((f) => f.ohms === highOhms);
  if (atLow.length === 0 || atHigh.length === 0) {
    return { ok: false, reason: `no published figure at both ${lowOhms} and ${highOhms} ohms` };
  }

  // Prefer a pair whose conditions already agree; only then report why not.
  for (const low of atLow) {
    for (const high of atHigh) {
      if (comparable(low, high).ok) return { ok: true, low, high };
    }
  }
  const why = comparable(atLow[0], atHigh[0]);
  return {
    ok: false,
    reason: why.ok ? 'no comparable pair' : why.reason,
  };
}

/**
 * A published impedance, with the connection it was stated for.
 *
 * Makers publish both: Audio Research states the Reference 5 at "600 ohms
 * balanced, 300 ohms single-ended". Those are two different operating
 * conditions, and comparing a balanced output impedance against a
 * single-ended input impedance is the same error as comparing a minimum
 * against a typical — it looks like a like-for-like ratio and is not one.
 */
export interface ImpedanceFigure {
  ohms: number;
  connection: 'balanced' | 'single_ended' | 'unstated';
  raw: string;
}

/** Read every impedance figure a maker's string states, with its connection. */
export function readImpedanceFigures(value: string): ImpedanceFigure[] {
  const out: ImpedanceFigure[] = [];
  for (const seg of value.split(/[;,]/)) {
    const m = /([\d.,]+)\s*(k)?\s*ohm/i.exec(seg);
    if (!m) continue;
    const n = Number(m[1].replace(/,/g, '')) * (m[2] ? 1000 : 1);
    if (!Number.isFinite(n)) continue;
    out.push({
      ohms: n,
      connection: /\bbalanced\b|\bxlr\b/i.test(seg) ? 'balanced'
        : /\bsingle[- ]?ended\b|\bse\b|\brca\b/i.test(seg) ? 'single_ended' : 'unstated',
      raw: seg.trim(),
    });
  }
  return out;
}

/**
 * The best like-for-like pair of a source's output impedance and a load's
 * input impedance — same connection, or both unstated.
 *
 * Returns the reason when no comparable pair exists, so a caller can stay
 * silent for a STATED cause rather than silently.
 */
export function pairImpedances(
  outputs: ImpedanceFigure[],
  inputs: ImpedanceFigure[],
): { ok: true; out: ImpedanceFigure; in: ImpedanceFigure }
  | { ok: false; reason: string } {
  if (outputs.length === 0 || inputs.length === 0) {
    return { ok: false, reason: 'an impedance figure is missing on one side' };
  }
  for (const o of outputs) {
    for (const i of inputs) {
      if (o.connection === i.connection) return { ok: true, out: o, in: i };
    }
  }
  return {
    ok: false,
    reason: `the published figures are stated for different connections — `
      + `${outputs.map((o) => o.raw).join(' / ')} against `
      + `${inputs.map((i) => i.raw).join(' / ')}`,
  };
}
