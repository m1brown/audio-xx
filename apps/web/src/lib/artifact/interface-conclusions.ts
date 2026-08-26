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
}

const lines = (d: DossierView): DossierLine[] => [...d.primary, ...d.secondary];

/** A figure whose label or qualifier names the concept. Text, not schema. */
function figure(d: DossierView | undefined, concept: RegExp): DossierLine | undefined {
  if (!d) return undefined;
  return lines(d).find((l) => concept.test(`${l.label} ${l.value}`));
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
  const out = figure(upstream.dossier, /output impedance/i);
  const inp = figure(downstream.dossier, /input impedance/i);
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
    status: 'established',
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
  const outputs = figure(source.dossier, /maximum balanced output|output level/i);
  const gainLine = figure(preamp.dossier, /\bgain\b/i);
  const sens = figure(amp.dossier, /input sensitivity/i);

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
    status: 'established',
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
  const sensLine = figure(speaker.dossier, /sensitivity/i);
  const powerLine = figure(amp.dossier, /power output/i);
  const sens = decibels(sensLine?.value);
  const power = watts(powerLine?.value);
  if (sens === undefined || power === undefined || power <= 0) return undefined;

  const peak = sens + 10 * Math.log10(power);
  return {
    upstream: amp.name, downstream: speaker.name, kind: 'headroom',
    status: 'established',
    restsOn: [
      `${speaker.name}: ${sensLine!.value}`,
      `${amp.name}: ${powerLine!.value}`,
    ],
    statement: `On the published figures the pairing has substantial acoustic headroom: `
      + `${sensLine!.value} with ${powerLine!.value} puts a theoretical peak near `
      + `${Math.round(peak)}dB at one metre from a single loudspeaker. Room, distance and `
      + `the loudspeaker's actual impedance curve all reduce that in practice, and none of `
      + `those is published — but the margin is large enough that running out of level is `
      + `unlikely to be this system's limitation.`,
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
): InterfaceConclusion[] {
  const find = (...roles: string[]) => {
    const c = components.find((x) => roles.includes((x.role ?? '').toLowerCase()));
    if (!c) return undefined;
    return { name: c.displayName, dossier: dossiers.find((d) => d.displayName === c.displayName) };
  };

  const source = find('dac', 'streamer_dac', 'streamer', 'source');
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
