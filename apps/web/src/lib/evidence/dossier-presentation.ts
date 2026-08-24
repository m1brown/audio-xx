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
import type { DossierPredicate, ProductDossier, ProductFact, SourceClass } from './product-dossier';

export interface DossierLine {
  label: string;
  value: string;
  /** Shown only where the claim is not maker-published. */
  standing?: 'reported' | 'measured';
  publication?: string;
  sourceUrl?: string;
  /**
   * WHAT KIND of evidence this line rests on.
   *
   * `ProductFact` carries `sourceClass`, and this function used to drop it —
   * so by the time a dossier reached the artifact, the fact that a figure was
   * maker-published and an observation was a reviewer's had been discarded.
   * The evidence ledger then had nothing to derive from and fell back to a
   * fixed sentence, which is how an assessment resting on published
   * specifications and three attributed Stereophile observations came to
   * describe itself as "Audio XX analysis of the components as described".
   *
   * Provenance must survive presentation. It travels with the line it
   * licensed, so a ledger can be derived rather than maintained.
   */
  sourceClass?: SourceClass;
}

export interface DossierView {
  displayName: string;
  /** Lead material — visible without interaction. */
  primary: DossierLine[];
  /** Everything else, behind an expansion. */
  secondary: DossierLine[];
  /** Absences worth stating. Usually empty. */
  gaps: string[];
  /**
   * Whether Audio XX holds anything worth opening the expansion for.
   *
   * A component used to vanish entirely when none of its facts happened to
   * land in the primary bucket — the ARC Reference 5 holds four published
   * specifications including its tube complement and rendered nothing at all.
   * Richness must track knowledge held, not which bucket a field falls into.
   */
  hasDetail: boolean;
  /** Shown when nothing is primary, so the expansion does not look empty. */
  detailSummary?: string;
  /**
   * An admissible photograph of THIS EXACT PRODUCT, or nothing.
   *
   * Resolved through the governed image boundary by the caller, never chosen
   * here: identity, provenance and rights are decided in
   * `lib/images/admission.ts`, and a presentation layer must not second-guess
   * them. What this field adds is that once an asset IS admitted, showing it
   * is a data operation — no renderer work, on any surface.
   *
   * ZERO EVIDENTIARY AUTHORITY. It is recognition, not evidence: it licenses
   * no fact, enters no calculation, and changes nothing about which facts were
   * selected above. Absence is a normal finished state and must render nothing
   * at all — no frame, no placeholder, no reserved space.
   */
  image?: { url: string; credit?: string };
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
    sourceClass: f.sourceClass,
  };
}

export function presentDossier(d: ProductDossier): DossierView {
  const primary: DossierLine[] = [];
  const secondary: DossierLine[] = [];

  // Review COVERAGE is primary — that a named publication has written about
  // this product is ownership-relevant on its own. The observations themselves
  // sit behind detail, each keeping its attribution and condition.
  if (d.reviews.length > 0) {
    primary.push({
      label: 'Independent review',
      value: [...new Set(d.reviews.map((r) => r.publication))].join(', '),
    });
    for (const r of d.reviews) {
      secondary.push({
        label: r.publication,
        value: r.claim
          + (r.condition ? ` — only ${r.condition.replace(/^[a-z_]+:\s*/i, '')}` : '')
          + (r.transferLimited ? ' (heard through other electronics)' : ''),
        // No standing marker. The line's LABEL is the publication, so the
        // provenance is already stated; the first version hard-coded
        // `standing: 'measured'` and labelled two dCS LISTENING comparisons
        // as measurements, which is a false claim about how they were made.
        publication: r.publication,
        sourceUrl: r.sourceUrl,
        // A reviewer heard something. Never a maker's specification, and never
        // promoted to one by being displayed next to specifications.
        sourceClass: 'listening_observation',
      });
    }
  }

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

  // Dimensions and weight alone are not knowledge worth a card. Anything else
  // — architecture, a tube or driver complement, a response figure, review
  // coverage — is.
  const SHIPPING = new Set(['dimensions', 'weight']);
  const meaningfulSecondary = secondary.filter((l) => !SHIPPING.has(l.label));
  const hasDetail = secondary.length > 0;

  const detailSummary = primary.length === 0 && meaningfulSecondary.length > 0
    ? `${secondary.length} published ${secondary.length === 1 ? 'detail' : 'details'} held`
    : undefined;

  return {
    displayName: d.displayName, primary, secondary, gaps, hasDetail, detailSummary,
  };
}

/** Does Audio XX hold enough about this product to be worth a card? */
export function worthRendering(v: DossierView): boolean {
  return v.primary.length > 0 || v.gaps.length > 0 || !!v.detailSummary;
}
