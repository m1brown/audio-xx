/**
 * The system's axis state, derived one way.
 *
 * THE DEFECT THIS FIXES. The FRANCE system reported the SAME axis three
 * different ways on one page:
 *
 *   Recognition        "with detail held back from the front"   (categorical 'smooth')
 *   Tonal signature    "Balanced"                                (numeric 0.1)
 *   Engineering        "2 of the 3 components lean the same way (detailed)"
 *                                                                (per-component counts)
 *
 * Three renderers, three sources, one axis. Recognition and Engineering stated
 * opposites.
 *
 * `systemAxes` (categorical) and `systemAxisNumeric` are two aggregations of
 * the same evidence and they diverge whenever a categorical pole falls inside
 * the numeric balanced band — which is exactly FRANCE's smooth_detailed at
 * +0.1. That divergence already caused `composeDominantCharacter()` to be
 * deleted in August 2026, on this same system, and it returned through
 * `characterRead` because that function kept reading the categorical field.
 *
 * So the numeric aggregate is now the only authority for a SYSTEM-level pole,
 * and every surface derives its label here. Per-component categoricals remain
 * valid — they describe one component and are not a system claim.
 */

/**
 * The balanced band. Inside it a system has not committed to a pole.
 *
 * ±0.35 is the value the Tonal Signature graph already used and documented as
 * "the same band the signature prose uses". This module makes that true rather
 * than aspirational.
 */
export const BALANCED_BAND = 0.35;

export type AxisPole = 'left' | 'right' | 'neutral';

export const AXIS_POLES: Record<string, { left: string; right: string }> = {
  warm_bright: { left: 'warm', right: 'bright' },
  smooth_detailed: { left: 'smooth', right: 'detailed' },
  elastic_controlled: { left: 'elastic', right: 'controlled' },
  airy_closed: { left: 'airy', right: 'closed' },
};

/** Which side of the band a numeric aggregate sits on. */
export function poleFor(n: number | undefined): AxisPole {
  if (typeof n !== 'number') return 'neutral';
  if (n < -BALANCED_BAND) return 'left';
  if (n > BALANCED_BAND) return 'right';
  return 'neutral';
}

/**
 * The system's committed value on one axis, or undefined inside the band.
 *
 * Undefined is the answer, not a gap to fill. A system at +0.1 has not leaned
 * anywhere, and manufacturing a direction from component counts is how the
 * contradiction happened.
 */
export function committedValue(axis: string, numeric: Record<string, number> | undefined): string | undefined {
  const poles = AXIS_POLES[axis];
  if (!poles) return undefined;
  const p = poleFor(numeric?.[axis]);
  if (p === 'neutral') return undefined;
  return p === 'left' ? poles.left : poles.right;
}

/**
 * The three axes Audio XX renders as tonal character.
 *
 * `airy_closed` is deliberately absent: airiness is largely emergent from room,
 * placement and recording rather than a stable system coordinate, so the graph
 * does not plot it and Recognition does not read it. It remains part of the
 * system's IDENTITY, which is why the contradiction gate uses the wider set.
 */
export const TONAL_CHARACTER_AXES = ['warm_bright', 'smooth_detailed', 'elastic_controlled'];

/** Identity, including the axis that carries spatial character. */
export const IDENTITY_AXES = [...TONAL_CHARACTER_AXES, 'airy_closed'];

/** Every axis the system has actually committed to, strongest first. */
export function committedSystemAxes(
  numeric: Record<string, number> | undefined,
  axes: string[] = TONAL_CHARACTER_AXES,
): Array<{ axis: string; value: string; magnitude: number }> {
  if (!numeric) return [];
  return axes
    .map((axis) => ({ axis, value: committedValue(axis, numeric), magnitude: Math.abs(numeric[axis] ?? 0) }))
    .filter((x): x is { axis: string; value: string; magnitude: number } => !!x.value)
    .sort((a, b) => b.magnitude - a.magnitude);
}

// ── Component patterns ──────────────────────────────────────────────

/**
 * How the components sit relative to one another on one axis.
 *
 * "2 of 3 lean the same way" is not coherence. On FRANCE's smooth_detailed the
 * two sources read detailed and the LOUDSPEAKER reads smooth — a split field
 * that the old counting described as agreement, discarding the one component
 * that disagreed and happens to matter most.
 */
export type AxisPattern =
  /** Every component with a reading leans the same way. */
  | { kind: 'agreement'; side: string; count: number }
  /** Components lean opposite ways. Whether that is a COUNTERWEIGHT is a
   *  licensing question this function does not answer. */
  | { kind: 'split'; sides: Array<{ side: string; components: string[] }> }
  /** Fewer than two components have a reading on this axis. */
  | { kind: 'insufficient' };

export function classifyAxis(
  axis: string,
  perComponentAxes: Array<{ name: string; axes?: Record<string, string> }>,
): AxisPattern {
  const byside = new Map<string, string[]>();
  for (const c of perComponentAxes) {
    const v = c.axes?.[axis];
    if (!v || v === 'neutral' || v === 'balanced') continue;
    byside.set(v, [...(byside.get(v) ?? []), c.name]);
  }
  const sides = [...byside.entries()].map(([side, components]) => ({ side, components }));
  const total = sides.reduce((n, s) => n + s.components.length, 0);
  if (total < 2) return { kind: 'insufficient' };
  if (sides.length === 1) return { kind: 'agreement', side: sides[0].side, count: total };
  return { kind: 'split', sides: sides.sort((a, b) => b.components.length - a.components.length) };
}
