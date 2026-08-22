/**
 * What a dossier SHOWS, as opposed to what it holds.
 *
 * Two rules, both aimed at the same failure. A dossier with fifteen predicates
 * will render fifteen lines if nothing stops it, and a page of fields is the
 * essay problem in table form.
 *
 *   PRIORITY — architecture, lineage, brand relationship, relevant
 *   specifications, status and upgrade path lead. Everything else is
 *   secondary and belongs behind an expansion.
 *
 *   ABSENCE — an unknown surfaces ONLY where it blocks a conclusion or a
 *   listener would reasonably expect to know it. An empty database field is
 *   not a reason to say anything.
 *
 * This module produces STRUCTURE, not sentences. It emits typed lines the
 * renderer lays out; it never composes prose, which is what keeps the dossier
 * out of the relational publication boundary.
 */
import type { DossierPredicate, ProductDossier, ProductFact } from './product-dossier';

export interface DossierLine {
  label: string;
  value: string;
  /** Shown only where the claim is not maker-published. */
  standing?: 'reported' | 'measured';
  publication?: string;
  sourceUrl?: string;
}

export interface DossierView {
  displayName: string;
  /** Lead material — visible without interaction. */
  primary: DossierLine[];
  /** Everything else, behind an expansion. */
  secondary: DossierLine[];
  /** Absences worth stating. Usually empty. */
  gaps: string[];
}

const LABELS: Partial<Record<DossierPredicate, string>> = {
  architecture_element: 'Architecture',
  manufacturing_relationship: 'Brand',
  parent_company: 'Brand',
  successor: 'Superseded by',
  predecessor: 'Replaces',
  generation: 'Generation',
  range_position: 'In the range',
  production_status: 'Status',
  factory_upgrade: 'Factory upgrade',
  circuit_lineage: 'Circuit lineage',
  brand_origin_country: 'Brand origin',
  design_origin_country: 'Designed in',
  manufacture_country: 'Built in',
  introduced: 'Introduced',
};

/** Lead predicates, in reading order. */
const PRIMARY: DossierPredicate[] = [
  'architecture_element', 'manufacturing_relationship', 'parent_company',
  'successor', 'production_status', 'range_position', 'factory_upgrade',
];

/** Specifications a listener acts on, as opposed to shipping data. */
const USEFUL_SPEC_ROLES = new Set([
  'amplifier_output', 'loudspeaker_sensitivity', 'loudspeaker_load',
  'loudspeaker_power_handling',
]);

function toLine(f: ProductFact): DossierLine {
  return {
    label: f.predicate === 'specification'
      ? (f.qualifier ?? 'Specification').replace(/_/g, ' ')
      : (LABELS[f.predicate] ?? f.predicate.replace(/_/g, ' ')),
    value: f.unit ? `${f.value} ${f.unit}` : f.value,
    standing: f.state === 'reported' ? 'reported'
      : f.state === 'measured' ? 'measured' : undefined,
    publication: f.publication,
    sourceUrl: f.sourceUrl,
  };
}

export function presentDossier(d: ProductDossier): DossierView {
  const primary: DossierLine[] = [];
  const secondary: DossierLine[] = [];

  for (const p of PRIMARY) {
    for (const f of d.facts.filter((x) => x.predicate === p)) primary.push(toLine(f));
  }

  for (const f of d.facts) {
    if (PRIMARY.includes(f.predicate)) continue;
    if (f.predicate === 'specification') {
      // A figure the listener would act on leads; dimensions and weight do not.
      (f.specRole && USEFUL_SPEC_ROLES.has(f.specRole) ? primary : secondary).push(toLine(f));
      continue;
    }
    secondary.push(toLine(f));
  }

  // Absence is expensive to print and cheap to accumulate, so only the
  // decision-relevant ones are stated, and each says what would close it.
  const gaps = d.unknowns
    .filter((u) => u.decisionRelevant && u.wouldCloseWith)
    .map((u) => u.wouldCloseWith as string);

  return { displayName: d.displayName, primary, secondary, gaps };
}
