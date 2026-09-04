/**
 * Active roles — what each component is actually DOING in this system.
 *
 * Product capability and functional role are different facts. An Eversolo
 * DMP-A6 is capable of streaming, D/A conversion and analogue output; an
 * Eversolo feeding a Chord Hugo digitally is DOING exactly one of those.
 * Reasoning from capability where role is known produced assessments that
 * spent their attention on bypassed circuits — the DMP-A6's analogue output
 * voltage in a system where its analogue stage carries no signal.
 *
 * This module answers, per component:
 *   - active function: the job the signal actually flows through;
 *   - bypassed functions: capabilities the established topology idles;
 *   - sonic leverage: how much of the system's audible character this
 *     stage plausibly determines, GIVEN its active function.
 *
 * Leverage is a causal/relevance judgment, not a doctrine. It rests on the
 * governed domain knowledge that transducers dominate audible character,
 * amplification interacts with the loudspeaker load, conversion shapes the
 * signal within a narrower envelope, and a bit-transport's contribution is
 * bounded by its interface behaviour. "Streamers don't matter" is NOT the
 * rule; "a streamer whose conversion and analogue stages are bypassed is
 * primarily streaming infrastructure in THIS system" is.
 *
 * Topology authority is inherited, not re-derived: `analyzeConversionPath`
 * (P1, 2026-09-03) decides whether the conversion path is established,
 * explicit or ambiguous. Under ambiguity NO bypass claims are made — a
 * function is only called bypassed when the established path idles it.
 */

import type { DossierView } from '@/lib/evidence/dossier-presentation';
import { analyzeConversionPath, type ConversionPathAnalysis } from './conversion-path';

export type SonicLeverage = 'very_high' | 'high' | 'moderate' | 'low';

export type ActiveFunction =
  | 'loudspeaker'
  | 'subwoofer'
  | 'headphone'
  | 'amplification'
  | 'preamplification'
  | 'dac'
  | 'source_with_conversion'
  | 'digital_transport'
  | 'turntable'
  | 'undetermined';

export interface ActiveComponentRole {
  name: string;
  /** The declared/extracted role word, normalised lowercase. */
  role: string;
  activeFunction: ActiveFunction;
  /** Capabilities the ESTABLISHED topology idles. Empty when unknown. */
  bypassed: string[];
  leverage: SonicLeverage;
  /** One clause for provenance: why this leverage, in this system. */
  rationale: string;
}

export interface ActiveRoleModel {
  roles: ActiveComponentRole[];
  /** How the conversion path was established, if at all. */
  topology: 'explicit' | 'unambiguous' | 'ambiguous' | 'no_conversion_question';
  conversion: ConversionPathAnalysis;
}

const norm = (r: string | undefined) => (r ?? '').toLowerCase();

function leverageFor(fn: ActiveFunction): { leverage: SonicLeverage; rationale: string } {
  switch (fn) {
    case 'loudspeaker':
      return {
        leverage: 'very_high',
        rationale: 'the transducer and its room interaction dominate what is audible',
      };
    case 'headphone':
      return { leverage: 'very_high', rationale: 'the transducer dominates what is audible' };
    case 'amplification':
      return {
        leverage: 'high',
        rationale: 'the amplifier works directly into the loudspeaker load',
      };
    case 'subwoofer':
      return {
        leverage: 'moderate',
        rationale: 'low-frequency foundation and room interaction below the mains',
      };
    case 'preamplification':
      return { leverage: 'moderate', rationale: 'every signal passes through its gain stage' };
    case 'dac':
    case 'source_with_conversion':
      return {
        leverage: 'moderate',
        rationale: 'conversion shapes the signal within a narrower envelope than transduction',
      };
    case 'turntable':
      return { leverage: 'high', rationale: 'mechanical playback shapes the source signal directly' };
    case 'digital_transport':
      return {
        leverage: 'low',
        rationale: 'with conversion and analogue stages bypassed, its contribution is '
          + 'bounded by digital-interface behaviour',
      };
    default:
      return { leverage: 'moderate', rationale: 'active function not established' };
  }
}

/**
 * Derive the active-role model for a system.
 *
 * `rawQuery` carries the listener's own words so explicitly stated
 * connections and exclusions govern (they always outrank inference).
 */
export function deriveActiveRoles(
  components: Array<{ displayName: string; role: string }>,
  dossiers: DossierView[],
  rawQuery?: string,
): ActiveRoleModel {
  const conversion = analyzeConversionPath(components, dossiers, rawQuery);
  const stageKind = new Map(conversion.stages.map((s) => [s.name, s.kind]));
  const excluded = new Set(conversion.excluded);

  const dedicatedDacPresent = conversion.stages.some(
    (s) => s.kind === 'dedicated_dac' && !excluded.has(s.name));

  /*
   * When is the path ESTABLISHED enough to assert bypasses?
   *  - the listener stated it (explicit); or
   *  - there is one natural reading: a dedicated DAC present alongside a
   *    conversion-capable source and a purely analogue amplifier — the DAC
   *    is in the path (that is what it is for), the source feeds it
   *    digitally. This mirrors clause A of the P1 invariant: one genuinely
   *    unambiguous interpretation may proceed.
   * Under `conversion.ambiguous` nothing is bypassed and conversion-capable
   * stages stay 'undetermined' — the clarification behaviour owns that case.
   */
  const established = conversion.explicit
    || (!conversion.ambiguous && dedicatedDacPresent);

  const topology: ActiveRoleModel['topology'] = conversion.ambiguous
    ? 'ambiguous'
    : conversion.explicit
      ? 'explicit'
      : conversion.stages.length > 0 ? 'unambiguous' : 'no_conversion_question';

  const roles: ActiveComponentRole[] = components
    .filter((c) => !excluded.has(c.displayName))
    .map((c) => {
      const r = norm(c.role);
      let fn: ActiveFunction;
      const bypassed: string[] = [];

      if (r.includes('speaker') && !r.includes('sub')) fn = 'loudspeaker';
      else if (r === 'subwoofer') fn = 'subwoofer';
      else if (r.includes('headphone')) fn = 'headphone';
      else if (r === 'preamplifier' || r === 'preamp') fn = 'preamplification';
      else if (r === 'turntable') fn = 'turntable';
      else if (r === 'amplifier' || r === 'integrated' || r === 'power_amp') {
        fn = 'amplification';
        // An amp whose own dossier evidences onboard conversion, in a system
        // whose established path converts upstream, idles that stage.
        if (established && stageKind.get(c.displayName) === 'amp_with_dac' && dedicatedDacPresent) {
          bypassed.push('onboard_dac');
        }
      } else if (r === 'dac') {
        fn = conversion.ambiguous ? 'undetermined' : 'dac';
      } else if (r === 'streamer_dac' || r === 'streamer' || r === 'source') {
        const converts = stageKind.get(c.displayName) === 'source_with_dac' || r === 'streamer_dac';
        if (conversion.ambiguous && converts) {
          fn = 'undetermined';
        } else if (established && dedicatedDacPresent && converts) {
          // A conversion-capable source feeding a dedicated DAC is a digital
          // transport in THIS system; its own conversion and analogue output
          // carry no signal.
          fn = 'digital_transport';
          bypassed.push('dac', 'analogue_output');
        } else if (established && dedicatedDacPresent) {
          fn = 'digital_transport';
        } else if (converts) {
          fn = 'source_with_conversion';
        } else {
          // A plain source with no dedicated DAC downstream: its own output
          // stage is doing the work.
          fn = 'source_with_conversion';
        }
      } else {
        fn = 'undetermined';
      }

      const { leverage, rationale } = leverageFor(fn);
      return { name: c.displayName, role: r, activeFunction: fn, bypassed, leverage, rationale };
    });

  return { roles, topology, conversion };
}

/** Ordinal weight for aggregations (graph, materiality). */
export const LEVERAGE_WEIGHT: Record<SonicLeverage, number> = {
  very_high: 1.0,
  high: 0.75,
  moderate: 0.4,
  low: 0.1,
};

export type Materiality = 'first_order' | 'secondary' | 'low';

/**
 * Functional role governs evidence RELEVANCE, not just weighting after the
 * fact: a dossier's lead lines should concern the job the component is
 * actually doing. For a source acting as pure digital transport, its
 * analogue-stage figures (line output level, DAC voicing, output impedance)
 * describe bypassed circuitry — demoted to the expansion, never deleted.
 * The evidence survives with its provenance; it just stops leading the card
 * for a function that carries no signal.
 */
export function demoteBypassedEvidence<T extends {
  displayName: string;
  primary: Array<{ label: string; value: string }>;
  secondary: Array<{ label: string; value: string }>;
}>(dossiers: T[], model: ActiveRoleModel): T[] {
  const BYPASSED_ANALOGUE = /line output|output level|output impedance|analog(?:ue)? output|d\/a|\bdac\b|conversion/i;
  return dossiers.map((d) => {
    const role = model.roles.find((r) => r.name === d.displayName);
    if (!role || role.activeFunction !== 'digital_transport') return d;
    const demote = d.primary.filter((l) => BYPASSED_ANALOGUE.test(`${l.label} ${l.value}`));
    if (demote.length === 0) return d;
    return {
      ...d,
      primary: d.primary.filter((l) => !demote.includes(l)),
      secondary: [...demote, ...d.secondary],
    };
  });
}

/**
 * How much an interface between two stages matters to what the listener
 * hears — from the leverage of its endpoints. Gaps are weighted by this,
 * never merely counted: a missing figure about a bypassed circuit is not
 * the same finding as a missing figure at the amplifier/loudspeaker
 * interface.
 */
export function interfaceMateriality(
  model: ActiveRoleModel,
  fromName: string,
  toName: string,
): Materiality {
  const lv = (n: string) =>
    model.roles.find((r) => r.name === n)?.leverage ?? 'moderate';
  const w = Math.min(LEVERAGE_WEIGHT[lv(fromName)], LEVERAGE_WEIGHT[lv(toName)]);
  if (w >= 0.75) return 'first_order';
  if (w >= 0.4) return 'secondary';
  return 'low';
}
