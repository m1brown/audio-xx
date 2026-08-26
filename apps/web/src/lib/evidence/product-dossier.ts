/**
 * ProductDossier — what Audio XX knows about a product, as atomic facts.
 *
 * WHY THIS EXISTS. Product knowledge was scattered across four stores with no
 * shared shape: catalog `Product`, `BrandProfile`, `ManufacturerFactV1` and
 * `IndependentReviewV1`. An audit of the FRANCE system found the largest
 * category was not "absent" but "held and never surfaced" — brand country, the
 * Goldmund/JOB corporate relationship, `Product.architecture`, and a
 * pre-classified editorial provenance ledger the renderer was told never to
 * read.
 *
 * TWO INDEPENDENT AXES (founder, 2026-08-22). Provenance and knowledge state
 * are separate:
 *
 *   sourceClass  WHO supports the claim
 *   state        WHAT Audio XX currently knows
 *
 * An absence is a STATE, not a kind of source. Representing "not established"
 * as an Audio XX interpretation would make our silence look like our opinion.
 *
 * INTERPRETATION IS NOT A FACT. This layer holds externally supported atomic
 * claims only. Audio XX's own reading of them is derived downstream and never
 * stored here — a dossier that can contain our prose is a dossier that will
 * fill with it.
 */

/** WHO supports the claim. Not a ladder — see docs/provenance-policy.md. */
export type SourceClass =
  /** The maker states it about its own product. */
  | 'maker_published'
  /** A third party measured it with instruments. */
  | 'independently_measured'
  /** An approved technical reference restates a specification it did not
   *  originate. Display only — see the admission rules below. */
  | 'third_party_reported'
  /** A reviewer heard something. Governed by the existing review doctrine. */
  | 'listening_observation'
  /** Audio XX's own curated catalog record. */
  | 'catalog';

/** WHAT Audio XX knows. Independent of who supports it. */
export type KnowledgeState = 'established' | 'reported' | 'measured' | 'not_established';

export type DossierPredicate =
  | 'predecessor' | 'successor' | 'generation' | 'circuit_lineage'
  | 'architecture_element'
  | 'brand_origin_country' | 'design_origin_country' | 'manufacture_country'
  | 'parent_company' | 'manufacturing_relationship'
  | 'introduced' | 'production_status' | 'range_position'
  | 'factory_upgrade'
  | 'specification';

/**
 * What a specification figure is ABOUT.
 *
 * Closes the power-output role collision. Eversolo publishes `power_output:
 * 13 W` for a streaming DAC, and the drive rule selected the amplifier as the
 * FIRST component exposing a `power_output` field — which for the FRANCE
 * system is the streamer, not the amplifier. A watt figure is not amplifier
 * output because it is measured in watts; it is amplifier output because it
 * describes what an amplifier delivers into a load.
 */
export type SpecRole =
  | 'amplifier_output' | 'loudspeaker_load' | 'loudspeaker_sensitivity'
  | 'loudspeaker_power_handling' | 'source_output' | 'physical' | 'other';

export interface ProductFact {
  productKey: string;
  predicate: DossierPredicate;
  /** Atomic. A scalar or short noun phrase — never a sentence. */
  value: string;
  unit?: string;
  /** The maker's own wording of a measurement condition, where stated. */
  qualifier?: string;
  /** Present on `specification` facts. Absent means the role is unknown, which
   *  is NOT the same as `other` — an unknown role may not be assumed usable. */
  specRole?: SpecRole;
  sourceClass: SourceClass;
  state: KnowledgeState;
  sourceUrl?: string;
  publication?: string;
  quotedText?: string;
}

/** A field Audio XX does not hold. A state, never a source. */
export interface UnknownField {
  predicate: DossierPredicate;
  /** Why a listener might care. Drives whether the absence is worth showing. */
  decisionRelevant: boolean;
  /** What would close it. */
  wouldCloseWith?: string;
  /**
   * WHICH physical quantity is missing (P0, 2026-08-26). The review composer
   * used to wrap the first gap it found — whatever it was — in the
   * explanation authored for the loudspeaker impedance-plot gap, and so told
   * a listener that an amplifier's rated output would reveal a loudspeaker's
   * impedance dips. Prose about a missing figure is licensed by the KIND of
   * figure; a gap with no stated kind licenses only its own naming.
   */
  quantity?: 'speaker_impedance_curve' | 'amplifier_rated_output'
    | 'speaker_load_profile' | 'speaker_sensitivity';
}

/** One admitted review observation, as the dossier exposes it. */
export interface ReviewCoverage {
  publication: string;
  claim: string;
  /** "kind: description", preserved verbatim. Part of the licence. */
  condition?: string;
  /** Made through other equipment — the finding travels weakly. */
  transferLimited?: boolean;
  sourceUrl?: string;
}

export interface ProductDossier {
  productKey: string;
  displayName: string;
  facts: ProductFact[];
  unknowns: UnknownField[];
  /** Independent-review evidence HELD for this product. Never a conclusion. */
  reviews: ReviewCoverage[];
}

// ── Type ③ admission ────────────────────────────────────────────────
/**
 * Approved technical references for third-party REPORTED specifications.
 *
 * Deliberately tiny and explicitly reviewed, on the same principle as the
 * publication whitelist. Retailers, marketplaces, spec aggregators, forums and
 * encyclopedias are ineligible — they transcribe without checking, carry a
 * commercial incentive on the same page as the figure, and routinely carry
 * specs forward across model generations. That last failure is the decisive
 * one: a page headed "WLM Diva" may describe any of four generations.
 */
const APPROVED_TECHNICAL_REFERENCES: Record<string, string> = {
  'stereophile.com': 'Stereophile',
  'www.stereophile.com': 'Stereophile',
  'hifinews.com': 'Hifi News',
  'www.hifinews.com': 'Hifi News',
};

/** Fields a maker would publish. A measurement or a judgement is not one. */
const STABLE_SPEC_FIELDS = new Set([
  'power_output', 'sensitivity', 'impedance', 'nominal_impedance',
  'frequency_response', 'power_handling', 'dimensions', 'weight',
  'inputs', 'outputs', 'driver_complement', 'tube_complement',
]);

export type ReportedRejection =
  | 'source_not_approved' | 'identity_not_exact' | 'field_not_a_stable_spec';

/**
 * May a third-party reported specification be admitted?
 *
 * Three conditions, all required. Identity uses the same rule as review
 * admission: a source may omit the BRAND in how it writes a product name, but
 * model and variant identity may not be approximate. "WLM Diva" does not
 * establish "WLM Diva Monitor".
 */
export function admitReportedSpec(input: {
  requestedProductName: string;
  reportedProductName: string;
  field: string;
  sourceUrl: string;
}): { admitted: true; publication: string } | { admitted: false; reason: ReportedRejection } {
  let host = '';
  try { host = new URL(input.sourceUrl).hostname.toLowerCase(); } catch { host = ''; }
  const publication = APPROVED_TECHNICAL_REFERENCES[host];
  if (!publication) return { admitted: false, reason: 'source_not_approved' };

  if (!STABLE_SPEC_FIELDS.has(input.field)) {
    return { admitted: false, reason: 'field_not_a_stable_spec' };
  }

  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const req = norm(input.requestedProductName).split(' ').filter(Boolean);
  const got = new Set(norm(input.reportedProductName).split(' ').filter(Boolean));
  // Every model/variant token of the requested product must appear. Brand
  // tokens may be missing; anything else may not.
  const missing = req.filter((t) => !got.has(t));
  const brandTokens = new Set(req.slice(0, 1));
  if (missing.some((t) => !brandTokens.has(t))) {
    return { admitted: false, reason: 'identity_not_exact' };
  }
  return { admitted: true, publication };
}

/** A reported spec may be shown. It may never be reasoned from. */
export function usableInCalculation(f: ProductFact): boolean {
  return f.sourceClass === 'maker_published' || f.sourceClass === 'independently_measured'
    || f.sourceClass === 'catalog';
}

/** The same rule, stated for the licensing layer. */
export function admissibleAsPremise(f: ProductFact): boolean {
  return usableInCalculation(f) || f.sourceClass === 'listening_observation';
}

// ── The read model ──────────────────────────────────────────────────

/** Specification facts already held, mapped into the dossier vocabulary. */
export interface HeldSpec {
  field: string;
  value: string;
  sourceUrl?: string;
  quotedText?: string;
  /**
   * Who published it, decided by the caller that holds the URL.
   *
   * Absent means UNKNOWN, and unknown must not be read as the manufacturer —
   * see the admission below.
   */
  sourceClass?: SourceClass;
}

/**
 * What a held specification field is ABOUT, given the component's chain role.
 *
 * Both halves are required. `power_output` on an amplifier is amplifier
 * output; the identical field on a streaming DAC is not, and the FRANCE system
 * contains exactly that pair. Where the role is unknown the spec role is left
 * UNDEFINED rather than guessed — an unknown role must not be treated as a
 * usable one.
 */
export function specRoleFor(field: string, role: string | undefined): SpecRole | undefined {
  const amp = role === 'amplifier' || role === 'integrated';
  const spk = role === 'speaker' || role === 'headphone';
  const src = role === 'dac' || role === 'streamer' || role === 'source'
    || role === 'preamplifier' || role === 'turntable';

  switch (field) {
    case 'power_output':
      if (amp) return 'amplifier_output';
      if (src) return 'source_output';
      return undefined;
    case 'sensitivity':
      return spk ? 'loudspeaker_sensitivity' : undefined;
    case 'impedance':
    case 'nominal_impedance':
      return spk ? 'loudspeaker_load' : undefined;
    case 'power_handling':
      return spk ? 'loudspeaker_power_handling' : undefined;
    case 'dimensions':
    case 'weight':
      return 'physical';
    default:
      return 'other';
  }
}

/**
 * Everything Audio XX knows about one product.
 *
 * A projection over sources that already exist — authored product facts,
 * held manufacturer specifications, and the catalog's own brand-origin record.
 * It stores nothing and acquires nothing.
 *
 * `Product.country` is mapped to `brand_origin_country` ONLY. The catalog
 * field is documented as "country of origin or primary manufacturing", which
 * conflates two things Audio XX must keep apart. Existing data is preserved
 * and read as what it actually establishes; `manufacture_country` is never
 * inferred from it.
 */
/**
 * May a held specification field appear AT ALL on a component in this role?
 *
 * THE UNIVERSAL INVARIANT (P0, 2026-08-26): a fact may only license reasoning
 * — including the reasoning embodied in showing it under a labelled predicate
 * — compatible with both its typed meaning and the physical role of the
 * component it belongs to.
 *
 * Eversolo publishes "Rated Power: 13W" for a streaming DAC — the unit's
 * power draw. Acquisition filed it under `power_output`, the only watt-shaped
 * field in the controlled vocabulary, and the dossier then printed POWER
 * OUTPUT 13W over the amplifier gloss on a component that drives nothing.
 * What a watt figure MEANS on a non-amplifier is not established, and a
 * figure whose meaning is not established licenses nothing — not a line, not
 * a gloss, not a relation. Same rule for loudspeaker-load fields on
 * non-loudspeakers. An unknown role is not a usable one: fail closed.
 */
export function factCompatibleWithRole(field: string, role: string | undefined): boolean {
  const amp = role === 'amplifier' || role === 'integrated';
  const spk = role === 'speaker' || role === 'headphone';
  switch (field) {
    case 'power_output':
      return amp;
    case 'sensitivity':
    case 'impedance':
    case 'nominal_impedance':
    case 'power_handling':
    case 'driver_complement':
    case 'cabinet_material':
      return spk;
    default:
      return true;
  }
}

export function dossierFor(
  productKey: string,
  displayName: string,
  input: {
    authoredFacts?: ProductFact[];
    heldSpecs?: HeldSpec[];
    role?: string;
    brandOriginCountry?: string;
    unknowns?: UnknownField[];
    /**
     * Admitted review observations. Exposed as COVERAGE — that Audio XX holds
     * a named publication's observation — with each observation carrying its
     * attribution, its condition and its transfer limitation. Appearing in a
     * dossier grants nothing: these do not become system conclusions, and the
     * licensing that governs them is unchanged.
     */
    reviews?: Array<{
      publication?: string; claim?: string; sourceUrl?: string;
      condition?: { kind?: string; description?: string };
    }>;
  } = {},
): ProductDossier {
  const facts: ProductFact[] = [];

  for (const f of input.authoredFacts ?? []) {
    if (f.productKey === productKey) facts.push(f);
  }

  for (const s of input.heldSpecs ?? []) {
    if (!factCompatibleWithRole(s.field, input.role)) continue;
    facts.push({
      productKey,
      predicate: 'specification',
      value: s.value,
      qualifier: s.field,
      specRole: specRoleFor(s.field, input.role),
      // NOT unconditionally maker-published. Every held spec was labelled that
      // way regardless of who served it, so the Audio Research DATABASE — a
      // third-party enthusiast site — appeared in the evidence ledger as
      // "published by the manufacturer". D-7: no claim stronger than its
      // source. Where the publisher was not established, the honest class is
      // the weaker one. The fact stays in the dossier either way; only the
      // claim about its provenance changes.
      sourceClass: s.sourceClass ?? 'third_party_reported',
      state: 'established',
      sourceUrl: s.sourceUrl,
      quotedText: s.quotedText,
    });
  }

  if (input.brandOriginCountry
    && !facts.some((f) => f.predicate === 'brand_origin_country')) {
    facts.push({
      productKey, predicate: 'brand_origin_country',
      value: input.brandOriginCountry,
      sourceClass: 'catalog', state: 'established',
    });
  }

  const reviews: ReviewCoverage[] = (input.reviews ?? [])
    .filter((r) => !!r.publication && !!r.claim)
    .map((r) => ({
      publication: r.publication as string,
      claim: r.claim as string,
      condition: r.condition?.description
        ? `${r.condition.kind ?? 'other'}: ${r.condition.description}`
        : undefined,
      transferLimited: r.condition?.kind === 'associated_equipment',
      sourceUrl: r.sourceUrl,
    }));

  return { productKey, displayName, facts, unknowns: input.unknowns ?? [], reviews };
}

/** The dossier's own view of a spec, for the drive rule to consult. */
export function specsWithRole(d: ProductDossier, role: SpecRole): ProductFact[] {
  return d.facts.filter((f) =>
    f.predicate === 'specification' && f.specRole === role && usableInCalculation(f));
}
