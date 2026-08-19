/**
 * Independent-review evidence, offered to reasoning.
 *
 * SLICE 4. The first slice where this evidence reaches a listener.
 *
 * The question this layer has to answer honestly is not "can we cite more
 * publications" but "does independent reporting make the analysis more
 * knowledgeable and more specific". Review prose that only adds adjectives has
 * not earned its place; an observation earns it by changing or strengthening a
 * premise the assessment reasons FROM.
 *
 * So only two of the four observation types become premises, and even then
 * only where they are semantically capable of it:
 *
 *   listening    carries an axis and a direction -> a D-12 premise on that axis
 *   measurement  carries a physical quantity     -> a premise on that domain
 *   comparison   is a claim about a PAIR, not about this product alone
 *   positioning  is market placement, not sound
 *
 * `comparison` and `positioning` are still returned as context the prompt can
 * read, because they are real evidence about the product. They simply may not
 * be the thing a sonic conclusion rests on.
 */

import type { ReviewObservation } from './independent-review';
import type { AttributeRecord } from '../relational-explain';

/** Physical quantities a measurement can speak to, and the domain they share. */
const MEASUREMENT_DOMAIN: Record<string, string> = {
  sensitivity: 'power_load',
  impedance: 'power_load',
  power_output: 'power_load',
};

const KNOWN_AXES = new Set([
  'warm_bright', 'smooth_detailed', 'elastic_controlled', 'airy_closed', 'scale_intimacy',
]);

/** What a measurement observation is about, when its claim names a quantity. */
function measurementQuantity(claim: string): string | undefined {
  const c = claim.toLowerCase();
  if (/\bsensitivit/.test(c)) return 'sensitivity';
  if (/\bimpedanc|\bohms?\b/.test(c)) return 'impedance';
  if (/\bpower output|\bwatts?\b|\bw\s+(?:rms|into)\b/.test(c)) return 'power_output';
  return undefined;
}

/**
 * Premises an observation licenses, with the attribution that must travel.
 *
 * `component` is the listener's own name for the part, since that is what the
 * prose and the relation set use. The observation's `productName` stays with
 * the attribution, so what survives into prose is the publication rather than
 * our re-labelling of the product.
 */
export function toAttributeRecords(
  component: string,
  observations: ReviewObservation[],
): AttributeRecord[] {
  const records: AttributeRecord[] = [];

  for (const o of observations) {
    if (o.observationType === 'listening') {
      // An axis and a direction, or it is prose rather than a premise.
      if (!o.axis || !KNOWN_AXES.has(o.axis) || !o.direction) continue;
      records.push({
        component,
        axis: o.axis,
        value: o.direction,
        tier: 'independent_review',
        scope: 'product',
        attribution: {
          publication: o.publication,
          sourceUrl: o.sourceUrl,
          condition: o.condition
            ? `${o.condition.kind}: ${o.condition.description}`
            : undefined,
        },
      });
      continue;
    }

    if (o.observationType === 'measurement') {
      const quantity = measurementQuantity(o.claim);
      const domain = quantity ? MEASUREMENT_DOMAIN[quantity] : undefined;
      if (!domain) continue;   // a THD figure is real and is not a premise here
      records.push({
        component,
        axis: domain,
        value: `${quantity}: ${o.claim}`,
        tier: 'independent_review',
        scope: 'product',
        attribution: {
          publication: o.publication,
          sourceUrl: o.sourceUrl,
          condition: o.condition
            ? `${o.condition.kind}: ${o.condition.description}`
            : undefined,
        },
      });
    }
  }

  return records;
}

/**
 * Two admitted observations on one axis pointing opposite ways.
 *
 * Derived at read time and never stored, because a stored disagreement would
 * be an aggregate — and averaging is exactly what destroys the most useful
 * thing review evidence carries. Where one exists, neither direction may be
 * asserted as settled; the assessment says the sources differ, names them, and
 * treats the axis as indeterminate.
 */
export interface Disagreement {
  component: string;
  axis: string;
  positions: Array<{ direction: string; publication: string; condition?: string }>;
}

export function findDisagreements(
  component: string,
  observations: ReviewObservation[],
): Disagreement[] {
  const byAxis = new Map<string, ReviewObservation[]>();
  for (const o of observations) {
    if (o.observationType !== 'listening' || !o.axis || !o.direction) continue;
    byAxis.set(o.axis, [...(byAxis.get(o.axis) ?? []), o]);
  }

  const out: Disagreement[] = [];
  for (const [axis, items] of byAxis) {
    const directions = new Set(items.map((o) => o.direction!.toLowerCase()));
    if (directions.size < 2) continue;
    out.push({
      component,
      axis,
      positions: items.map((o) => ({
        direction: o.direction!,
        publication: o.publication,
        condition: o.condition ? `${o.condition.kind}: ${o.condition.description}` : undefined,
      })),
    });
  }
  return out;
}

/** Context the prompt may read but which licenses no sonic premise. */
export function contextObservations(observations: ReviewObservation[]): ReviewObservation[] {
  return observations.filter(
    (o) => o.observationType === 'comparison' || o.observationType === 'positioning');
}
