/**
 * Interface conclusions — what the acquired figures let Audio XX now settle.
 *
 * Four interfaces in the Nathan chain were reported as unresolved. None of
 * them was unresolvable; the numbers simply had not been fetched. With an
 * output impedance on one side and an input impedance on the other, a loading
 * question stops being a matter of opinion and becomes arithmetic — and
 * arithmetic over two published figures is the strongest kind of conclusion
 * this product makes.
 *
 * These are ESTABLISHED, and they are established about ELECTRICAL BEHAVIOUR
 * only. A comfortable impedance ratio means the preamplifier is not being
 * asked to drive something it cannot; it says nothing whatever about tone, and
 * the scope note that travels with the sonic layer applies here in reverse.
 *
 * Every conclusion names both figures it rests on and the condition under
 * which they were stated. Balanced and single-ended are NOT interchangeable —
 * the Reference 5 is 600 ohms balanced and 300 single-ended, the Rossini 2
 * ohms and 51 — so a conclusion drawn from balanced figures says so, and does
 * not silently describe a listener who is running RCA.
 */

import { acousticHeadroom } from '@/lib/evidence/physical-quantities';
import type { DossierView, DossierLine } from '@/lib/evidence/dossier-presentation';

export type ConclusionStatus = 'established' | 'unknown';

export interface InterfaceConclusion {
  /** Signal-chain pair this is about. */
  upstream: string;
  downstream: string;
  kind: 'loading' | 'level' | 'headroom';
  status: ConclusionStatus;
  statement: string;
  /** The figures it rests on, for the reader and for the ledger. */
  restsOn: string[];
  /**
   * Whether the established finding is a comfortable one.
   *
   * Set on established conclusions only. Lets the review say ONE thing about
   * the engineering as a whole — "no electrical bottleneck" — without
   * re-parsing its own prose to find out.
   */
  favourable?: boolean;
  /**
   * The load-bearing numbers, structured.
   *
   * The editorial layer composes a one-paragraph engineering summary from
   * these instead of re-parsing its own prose. Keys by kind:
   *   loading  — outOhms, inOhms, ratio
   *   level    — fraction (of preamp output at which the amp reaches full power)
   *   headroom — peakDb, watts, loadOhms, sensitivity
   */
  figures?: Record<string, number | string>;
}

const lines = (d: DossierView): DossierLine[] => [...d.primary, ...d.secondary];

/**
 * A line that both NAMES the concept and CARRIES a usable figure.
 *
 * The parser is not optional and the reason is a real defect: the dCS
 * dossier carries an admitted Stereophile observation reading "measured
 * performance was beyond reproach, with wide input sampling range, very low
 * output impedance, and excellent distortion metrics". It mentions output
 * impedance, it sorts above the typed specification, and it contains no
 * number. A first-match-on-text lookup found it, failed to read ohms, and the
 * review announced that the output impedance was unpublished — four lines
 * above where the dossier printed "2 ohms".
 *
 * So a line qualifies only if its VALUE parses into the quantity the caller
 * needs. Prose about a quantity is not the quantity.
 */
function figure(
  d: DossierView | undefined,
  concept: RegExp,
  parse: (v: string) => number | undefined,
): DossierLine | undefined {
  if (!d) return undefined;
  return lines(d).find(
    (l) => concept.test(`${l.label} ${l.value}`) && parse(l.value) !== undefined,
  );
}

/** Ohms from "600 ohms" or "47K ohms". Returns undefined rather than guessing. */
export function ohms(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const m = /([\d.,]+)\s*(k?)\s*ohm/i.exec(value);
  if (!m) return undefined;
  const n = Number(m[1].replace(/,/g, ''));
  if (!Number.isFinite(n)) return undefined;
  return m[2] ? n * 1000 : n;
}

/** Volts from "1.7 volts" or "2V". */
function volts(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const m = /([\d.]+)\s*v(?:olts?)?\b/i.exec(value);
  return m ? Number(m[1]) : undefined;
}

/** dB from "92.5dB". */
function decibels(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const m = /([\d.]+)\s*db/i.exec(value);
  return m ? Number(m[1]) : undefined;
}

/**
 * The wattage the maker states AT a particular load.
 *
 * Segments are read separately and a "typical" figure preferred, so a
 * multi-figure specification yields the number that actually applies to this
 * loudspeaker rather than whichever appeared first.
 */
export function wattsAtStatedLoad(value: string, load: number): number | undefined {
  // Commas separate ladder entries as often as semicolons do — and a
  // comma-separated ladder split only on ';' returned the FIRST wattage for
  // whichever load matched anywhere in the string (30W for a 4-ohm query
  // against "30 W/ch (8 ohms), 60 W/ch (4 ohms)"). A comma inside a
  // parenthetical ("1 ohm, music signals") splits harmlessly: the fragment
  // without a watt figure matches nothing (P1, 2026-09-13).
  // A comma splits only where a NEW watt entry begins: Accuphase writes
  // "30 W/ch (8 ohms), 60 W/ch (4 ohms)" (comma between entries) while
  // Butler writes "128 Watts, RMS typical @ 8 Ohms" (comma inside one).
  const segments = value.split(/;|,(?=[^,;]*?\d+(?:\.\d+)?\s*W)/i);
  const atLoad = segments.filter((seg) => new RegExp(`${load}\\s*ohm`, 'i').test(seg));
  if (atLoad.length === 0) return undefined;
  const chosen = atLoad.find((seg) => /typical/i.test(seg)) ?? atLoad[0];
  return watts(chosen);
}

/** One rung of a maker's power ladder: a stated load and its stated output. */
export interface StatedPowerEntry { ohms: number; watts: number }

/**
 * Every load the maker actually states, with its own figure.
 *
 * BOUNDED SYSTEM JUDGMENT (capability, 2026-09-15). When a ladder's stated
 * loads BRACKET a loudspeaker's nominal impedance without including it,
 * `wattsAtStatedLoad` rightly returns nothing — no figure may be invented
 * across loads. But the bracket itself is a derived relationship the
 * published facts fully support, and reasoning FROM the two neighbouring
 * published figures (never interpolating between them) is what turns "the
 * maker has not stated it" into a bounded judgment. Same segment vocabulary
 * as `wattsAtStatedLoad`, so the two readings cannot diverge.
 */
export function statedPowerEntries(value: string): StatedPowerEntry[] {
  const segments = value.split(/;|,(?=[^,;]*?\d+(?:\.\d+)?\s*W)/i);
  const out: StatedPowerEntry[] = [];
  for (const seg of segments) {
    const lm = /(\d+(?:\.\d+)?)\s*ohms?/i.exec(seg);
    const w = watts(seg);
    if (lm && w !== undefined) out.push({ ohms: Number(lm[1]), watts: w });
  }
  return out;
}

/**
 * The nearest stated loads either side of an unstated one — or undefined
 * when the published ladder does not actually bracket it.
 */
export function statedPowerBracket(
  value: string,
  load: number,
): { above: StatedPowerEntry; below: StatedPowerEntry } | undefined {
  const entries = statedPowerEntries(value);
  const above = entries.filter((e) => e.ohms > load).sort((a, b) => a.ohms - b.ohms)[0];
  const below = entries.filter((e) => e.ohms < load).sort((a, b) => b.ohms - a.ohms)[0];
  if (!above || !below) return undefined;
  return { above, below };
}

/** Watts at a stated load from "200 Watts into 4 ohm loads". */
function watts(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const m = /([\d.,]+)\s*w(?:atts?)?\b/i.exec(value);
  return m ? Number(m[1].replace(/,/g, '')) : undefined;
}

/**
 * THE LOADING RULE.
 *
 * A source drives the input it feeds comfortably when that input's impedance
 * is much higher than the source's output impedance. The conventional
 * engineering margin is a factor of ten; below it the source's own output
 * stage starts to shape frequency response and distortion, and the interface
 * stops being neutral. Audio XX states the ratio and the threshold rather than
 * a verdict, so a reader can see how much margin there actually is.
 */
export const LOADING_RULE = {
  threshold: 10,
  statement: 'An input impedance at least ten times the driving component’s output '
    + 'impedance is the conventional margin for an interface that does not colour '
    + 'the signal.',
  rationale: 'Below roughly 10:1 the source’s output stage begins to influence '
    + 'frequency response and distortion at the interface.',
  attribution: 'Audio XX engineering convention, not a manufacturer claim.',
} as const;

function loadingConclusion(
  upstream: { name: string; dossier?: DossierView },
  downstream: { name: string; dossier?: DossierView },
): InterfaceConclusion | undefined {
  const out = figure(upstream.dossier, /output impedance/i, ohms);
  const inp = figure(downstream.dossier, /input impedance/i, ohms);
  const outOhms = ohms(out?.value);
  const inOhms = ohms(inp?.value);

  if (!out || !inp || outOhms === undefined || inOhms === undefined || outOhms <= 0) {
    const missing = !out || outOhms === undefined
      ? `${upstream.name}'s output impedance`
      : `${downstream.name}'s input impedance`;
    return {
      upstream: upstream.name, downstream: downstream.name, kind: 'loading',
      status: 'unknown', restsOn: [],
      statement: `Whether ${upstream.name} drives ${downstream.name} without loading `
        + `effects is not established: ${missing} is not published.`,
    };
  }

  const ratio = inOhms / outOhms;
  const comfortable = ratio >= LOADING_RULE.threshold;

  const rounded = ratio >= 100 ? Math.round(ratio / 10) * 10 : Math.round(ratio);

  return {
    upstream: upstream.name, downstream: downstream.name, kind: 'loading',
    status: 'established', favourable: comfortable,
    figures: { outOhms, inOhms, ratio: rounded },
    restsOn: [
      `${upstream.name}: ${out.value} (${out.label.toLowerCase()})`,
      `${downstream.name}: ${inp.value} (${inp.label.toLowerCase()})`,
    ],
    statement: `${upstream.name} into ${downstream.name} is a settled question on the `
      + `published figures: ${out.value} driving ${inp.value}, a ratio of about `
      + `${rounded.toLocaleString()}:1. `
      + (comfortable
        ? `That is far above the ten-to-one margin conventionally taken as the point `
          + `where a source's output stage stops influencing the interface, so nothing `
          + `here constrains what the pair can do. It is a statement about electrical `
          + `behaviour and carries no implication about tone.`
        : `That is below the ten-to-one margin conventionally taken as the point where a `
          + `source's output stage begins to influence frequency response at the `
          + `interface, which makes this the one connection worth examining.`),
  };
}

/**
 * Whether the amplifier can be driven to full output, and where that leaves
 * the volume control.
 *
 * Useful because it is actionable in a way most specifications are not: a
 * listener whose amplifier reaches full output at a quarter of the
 * preamplifier's travel is operating the volume control in its least linear
 * region, and the fix costs nothing.
 */
function levelConclusion(
  source: { name: string; dossier?: DossierView },
  preamp: { name: string; dossier?: DossierView },
  amp: { name: string; dossier?: DossierView },
): InterfaceConclusion | undefined {
  const outputs = figure(source.dossier, /maximum balanced output|output level/i, volts);
  const gainLine = figure(preamp.dossier, /\bgain\b/i,
    (v) => (/([\d.]+)\s*db/i.test(v) ? Number(/([\d.]+)\s*db/i.exec(v)![1]) : undefined));
  const sens = figure(amp.dossier, /input sensitivity/i, volts);

  const gainDb = gainLine ? Number(/([\d.]+)\s*db/i.exec(gainLine.value)?.[1]) : undefined;
  const needed = volts(sens?.value);
  if (!outputs || gainDb === undefined || !Number.isFinite(gainDb) || needed === undefined) {
    return undefined;
  }

  // Read the modest setting, not the maximum: the point is what the listener
  // should choose, and 2V is the conventional line level.
  const chosen = /\b2V\b/.test(outputs.value) ? 2 : volts(outputs.value);
  if (chosen === undefined) return undefined;

  const atAmp = chosen * (10 ** (gainDb / 20));
  const fraction = needed / atAmp;
  if (!Number.isFinite(fraction) || fraction <= 0) return undefined;

  return {
    upstream: preamp.name, downstream: amp.name, kind: 'level',
    status: 'established', favourable: true,
    figures: { fraction: Math.round(fraction * 100) },
    restsOn: [
      `${source.name}: ${outputs.value}`,
      `${preamp.name}: ${gainLine!.value} (${gainLine!.label.toLowerCase()})`,
      `${amp.name}: ${sens!.value} (${sens!.label.toLowerCase()})`,
    ],
    statement: `There is far more gain in this chain than it needs. At the ${source.name}'s `
      + `${chosen}V setting, ${preamp.name}'s ${gainDb}dB brings roughly `
      + `${atAmp.toFixed(1)}V to an amplifier that reaches full output on `
      + `${needed}V — so full power arrives at about ${Math.round(fraction * 100)}% of the `
      + `preamplifier's output, and normal listening will sit low on its volume control. `
      + `If the ${source.name} is set higher than ${chosen}V, that margin grows and the `
      + `usable range of the control shrinks further.`,
  };
}

/** Acoustic headroom from sensitivity and rated power. */
function headroomConclusion(
  amp: { name: string; dossier?: DossierView },
  speaker: { name: string; dossier?: DossierView },
): InterfaceConclusion | undefined {
  const sensLine = figure(speaker.dossier, /sensitivity/i, decibels);
  const powerLine = figure(amp.dossier, /power output/i, watts);
  const loadLine = figure(speaker.dossier, /impedance/i, ohms);
  const sens = decibels(sensLine?.value);
  const load = ohms(loadLine?.value);
  if (sens === undefined || !powerLine || load === undefined) return undefined;

  /*
   * THE FIGURE AT THE LOUDSPEAKER'S OWN LOAD.
   *
   * The maker publishes three: "Minimum 100 Watts RMS @ 8 Ohms; 128 Watts,
   * RMS typical @ 8 Ohms; 200 Watts, RMS typical @ 4 Ohms". Taking the first
   * number took the MINIMUM at EIGHT ohms into a four-ohm loudspeaker, and
   * put the theoretical peak at 113dB where the relevant figure gives 115.5.
   * Wrong quantity, wrong load, and wrong by more than the rounding hid.
   */
  /*
   * NO FIGURE AT THIS LOAD, NO HEADROOM CONCLUSION (P1, 2026-09-13). The
   * `?? watts(value)` fallback did exactly what the comment above warns
   * against: with no watt figure at the loudspeaker's stated load it took
   * whatever number the string offered and reasoned as if it applied — an
   * Accuphase whose maker states 30W/8Ω and 60W/4Ω was judged at "30W at
   * the 6-ohm load". A ladder that brackets the load does not state it;
   * the honest state is unresolved, and the unresolved path already says
   * which figure would close it.
   */
  const power = wattsAtStatedLoad(powerLine.value, load);
  if (power === undefined || power <= 0) return undefined;

  /*
   * 2.83V IS NOT ONE WATT (bad-drive-match control, 2026-08-27).
   *
   * Panel and low-impedance loudspeakers publish sensitivity at 2.83V/1m.
   * Into 8 ohms that IS one watt; into 4 ohms it is TWO, so reading the
   * figure as per-watt flatters the pairing by 3dB — the Magnepan LRS at
   * "86dB / 2.83V" is an 83dB/W loudspeaker, and a 32W valve amplifier was
   * being told it had headroom to spare. Where the sensitivity line states
   * 2.83V, convert to per-watt at the stated load before any arithmetic.
   */
  /*
   * ONE ARITHMETIC, ONE CALIBRATION (P1, 2026-09-13): the 2.83V conversion
   * and banding moved to `acousticHeadroom`, which the drive-conclusion
   * lane reads too — the same figures can no longer yield two verdicts.
   * The modest band is CONDITION-DEPENDENT prose: a one-metre theoretical
   * ceiling establishes arithmetic, never the listener's seat or level, so
   * "a live constraint" is licensed only by the severe band.
   */
  const h = acousticHeadroom(power, load, sensLine!.value);
  if (!h) return undefined;
  const { peakDb: peak, sensPerWatt, band } = h;
  const statedAt283 = /2\.83\s*v/i.test(sensLine!.value);
  const perWattNote = statedAt283
    ? ` (about ${sensPerWatt.toFixed(1)}dB per watt into ${load} ohms)` : '';
  const statement = band === 'generous'
    ? `On the published figures the pairing has substantial acoustic headroom: `
      + `${sensLine!.value}${perWattNote} `
      + `with the maker's ${power}W figure at the ${load}-ohm load this `
      + `loudspeaker presents puts a theoretical peak near ${peak.toFixed(1)}dB at one metre `
      + `— a ceiling that assumes rated power into the real load, before room and listening `
      + `distance take their share. The margin is large enough that running out of level is `
      + `unlikely to be this system's limitation.`
    : band === 'severe'
      ? `On the published figures this pairing is genuinely power-constrained: `
        + `${sensLine!.value}${perWattNote} `
        + `and the maker's ${power}W figure put the theoretical ceiling near `
        + `${peak.toFixed(1)}dB at one metre — a deficit no ordinary room or seat `
        + `recovers. Running out of level is a live constraint of this pairing.`
      : band === 'modest'
        ? `On the published figures headroom is a real question for this pairing: `
          + `${sensLine!.value}${perWattNote} `
          + `and the maker's ${power}W figure put the theoretical ceiling near `
          + `${peak.toFixed(1)}dB at one metre, before room and listening distance take `
          + `their share. Whether that bites depends on how far you sit and how loud `
          + `you listen: near-field at moderate levels it may be sufficient; at a `
          + `distant seat or high levels the amplifier will be working near the top `
          + `of its range. The figures alone do not settle which is your case.`
        : `On the published figures the pairing has workable but not generous headroom: `
          + `${sensLine!.value}${perWattNote} `
          + `with the maker's ${power}W figure puts the theoretical peak near `
          + `${peak.toFixed(1)}dB at one metre, before room and listening distance take `
          + `their share. Ordinary levels are comfortable; sustained high-level listening `
          + `in a larger room will use much of what this amplifier has.`;

  return {
    upstream: amp.name, downstream: speaker.name, kind: 'headroom',
    status: 'established', favourable: band !== 'severe',
    figures: { peakDb: peak, watts: power, loadOhms: load, sensitivity: sensPerWatt },
    restsOn: [
      `${speaker.name}: ${sensLine!.value}`,
      `${amp.name}: ${power}W at ${load} ohms (from ${powerLine.value})`,
    ],
    statement,
  };
}

/**
 * Every interface conclusion this chain supports.
 *
 * Order is signal order, so a reader meets them in the order the music does.
 */
export function interfaceConclusions(
  components: Array<{ displayName: string; role: string }>,
  dossiers: DossierView[],
  opts?: {
    /**
     * Conversion-path authority (P1, 2026-09-03): with more than one
     * DAC-capable stage and no listener-stated connection, WHICH source
     * feeds the analogue chain is not established. The single-slot `find`
     * below would silently pick the first role match (dropping, e.g., an
     * explicitly supplied Chord Hugo) and assert interfaces along a path
     * nobody supplied. When the caller reports ambiguity, source-adjacent
     * interfaces are not composed; amp→speaker remains, because that
     * relationship does not depend on the conversion path.
     */
    conversionPathAmbiguous?: boolean;
  },
): InterfaceConclusion[] {
  const find = (...roles: string[]) => {
    const c = components.find((x) => roles.includes((x.role ?? '').toLowerCase()));
    if (!c) return undefined;
    return { name: c.displayName, dossier: dossiers.find((d) => d.displayName === c.displayName) };
  };

  const pathUnknown = opts?.conversionPathAmbiguous === true;
  const source = pathUnknown ? undefined : find('dac', 'streamer_dac', 'streamer', 'source');
  const preamp = find('preamplifier', 'preamp');
  const amp = find('amplifier', 'integrated');
  const speaker = find('speaker');

  const out: InterfaceConclusion[] = [];
  if (source && preamp) out.push(...[loadingConclusion(source, preamp)].filter(Boolean) as InterfaceConclusion[]);
  if (preamp && amp) out.push(...[loadingConclusion(preamp, amp)].filter(Boolean) as InterfaceConclusion[]);
  if (source && preamp && amp) {
    const level = levelConclusion(source, preamp, amp);
    if (level) out.push(level);
  }
  if (amp && speaker) {
    const headroom = headroomConclusion(amp, speaker);
    if (headroom) out.push(headroom);
  }
  // An "unknown" verdict is worth printing only where the reader could act on
  // it; a chain with no source and no preamp has nothing to report.
  return out.filter((c) => c.status === 'established' || c.restsOn.length === 0);
}
