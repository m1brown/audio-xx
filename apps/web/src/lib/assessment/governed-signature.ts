/**
 * Governed tonal signature — the sound-profile graph, re-licensed.
 *
 * The licensing gate removed the Tonal Signature unconditionally because
 * "aggregating per-component axes into system character is a rule nobody
 * established." This module establishes that rule, as a GOVERNED INFERENCE:
 *
 *   - only ACTIVE functions contribute. A component whose conversion and
 *     analogue stages are bypassed does not colour the analogue signal, so
 *     its authored DAC voicing cannot move the system marker;
 *   - influence is weighted by causal leverage in the instantiated signal
 *     path (transducer > amplification > conversion > transport), not
 *     averaged as if every box mattered equally;
 *   - an axis is plotted only when at least one component of moderate-or-
 *     higher leverage carries an authored/observed value on it. Absence is
 *     the honest state for an axis the evidence does not reach;
 *   - the marker is quantised to coarse steps and the reading is flagged
 *     `inferred`, so the presentation cannot imply measurement precision
 *     the derivation does not have.
 *
 * The graph complements the written verdict: expected character of the
 * system as configured, at a glance — categorical and ordinal underneath,
 * never falsely numeric.
 */

import type { AxisReading } from '../artifact/canonical';
import { resolveAxisIntensity, type PrimaryAxisLeanings } from '../axis-types';
import { type ActiveRoleModel, LEVERAGE_WEIGHT } from './active-roles';

type GraphAxisKey = 'warm_bright' | 'smooth_detailed' | 'elastic_controlled';

const GRAPH_AXES: Array<{ key: GraphAxisKey; left: string; right: string }> = [
  { key: 'warm_bright', left: 'Warm', right: 'Bright' },
  { key: 'smooth_detailed', left: 'Smooth', right: 'Detailed' },
  { key: 'elastic_controlled', left: 'Elastic', right: 'Controlled' },
];

/**
 * Intensity with the mid-band labels honoured: 'balanced' and 'moderate' are
 * midpoints, not second-pole commitments. `resolveAxisIntensity` maps any
 * unrecognised categorical to +1, which would turn "balanced" into a lean.
 */
function intensity(axes: PrimaryAxisLeanings, key: GraphAxisKey): number {
  const categorical = axes[key] as string | undefined;
  if (categorical === 'balanced' || categorical === 'moderate') {
    const n = axes[`${key}_n` as keyof PrimaryAxisLeanings];
    return typeof n === 'number' ? n : 0;
  }
  return resolveAxisIntensity(axes, key);
}

export interface GovernedAxisReading extends AxisReading {
  /** Always 'inferred': the licence class of the whole derivation. */
  basis: 'inferred';
}

/**
 * Derive the system sound profile from per-component axis knowledge,
 * weighted by active-role leverage. Returns undefined when no axis is
 * plottable — the graph is then absent rather than fabricated.
 */
export function governedTonalSignature(
  perComponentAxes: Array<{ name: string; axes: PrimaryAxisLeanings }>,
  model: ActiveRoleModel,
  opts?: {
    /**
     * Components Audio XX holds admitted evidence about (non-empty dossier).
     * A contributor QUALIFIES an axis only when it is evidenced: catalog
     * axes with zero held facts are exactly the Leben/Cornwall incident —
     * authored character standing in for evidence — and license nothing on
     * their own. Evidenced components' axes are the character encoding of
     * knowledge the store actually corroborates.
     */
    evidencedComponents?: Set<string>;
    /**
     * Axes an established CONSTRAINT makes unreadable (the system does not
     * operate as its parts suggest there — a power mismatch shows up first
     * as dynamics and control). Same scope rule as `readableAxisState`.
     */
    constrainedAxes?: string[];
  },
): GovernedAxisReading[] | undefined {
  if (!perComponentAxes.length) return undefined;

  const weightFor = (name: string): number => {
    const role = model.roles.find((r) => r.name === name
      || r.name.toLowerCase() === name.toLowerCase());
    // A component excluded from the active chain (listener said it is not in
    // use) has no entry in the role model and contributes nothing.
    if (!role) return 0;
    // Undetermined conversion stages under ambiguity contribute nothing —
    // plotting them would assert the path the clarification is still asking
    // about.
    if (role.activeFunction === 'undetermined') return 0;
    return LEVERAGE_WEIGHT[role.leverage];
  };

  const evidenced = (name: string) => !opts?.evidencedComponents
    || opts.evidencedComponents.has(name)
    || [...opts.evidencedComponents].some((e) => e.toLowerCase() === name.toLowerCase());

  const readings: GovernedAxisReading[] = [];
  for (const axis of GRAPH_AXES) {
    if (opts?.constrainedAxes?.includes(axis.key)) continue;
    let sum = 0;
    let weight = 0;
    // ≥1 EVIDENCED contributor at moderate+ leverage with a value.
    let qualified = false;
    for (const pc of perComponentAxes) {
      const w = weightFor(pc.name);
      if (w <= 0) continue;
      const v = intensity(pc.axes, axis.key);
      if (Number.isNaN(v)) continue;
      sum += v * w;
      weight += w;
      if (w >= LEVERAGE_WEIGHT.moderate && evidenced(pc.name)) qualified = true;
    }
    if (!qualified || weight === 0) continue;

    const n = sum / weight;
    const clamped = Math.max(-1.5, Math.min(1.5, n));
    // Coarse 5-point steps: ordinal honesty, not measurement.
    const position = Math.round((50 + clamped * 24) / 5) * 5;
    const pole = n < -0.35 ? ('left' as const) : n > 0.35 ? ('right' as const) : ('neutral' as const);
    readings.push({
      axis: axis.key, left: axis.left, right: axis.right, pole, position, basis: 'inferred',
    });
  }

  return readings.length > 0 ? readings : undefined;
}
