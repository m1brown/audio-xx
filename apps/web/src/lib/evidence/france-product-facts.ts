/**
 * Authored product facts — FRANCE system only.
 *
 * SCOPE (founder, 2026-08-22): Eversolo DMP-A6, JOB INTegrated, WLM Diva
 * Monitor. This is not the beginning of catalog-wide enrichment; coverage
 * remains demand-driven, and a system a real listener owns is the demand.
 *
 * Every entry carries its source class and URL. First-party where available.
 * Where only third-party reporting exists, the fact is admitted ONLY under the
 * type-③ rules in `product-dossier.ts` — which the WLM sensitivity figures
 * fail, deliberately and visibly.
 */
import type { ProductFact, UnknownField } from './product-dossier';

const F = (
  productKey: string,
  predicate: ProductFact['predicate'],
  value: string,
  extra: Partial<ProductFact> = {},
): ProductFact => ({
  productKey, predicate, value,
  sourceClass: 'maker_published', state: 'established', ...extra,
});

const EVERSOLO_SHOP = 'https://shop.zidoo.tv/blogs/news/the-eversolo-dmp-a6-gen-2-all-in-one-music-streamer-is-officially-released';
const AUDIO46_A6 = 'https://audio46.com/products/eversolo-dmp-a6-dac-amp-network-streamer';
const JOBSYS_ARCHIVE = 'https://web.archive.org/web/20160309134059/http://jobsys.com/products.htm';
const STEREOPHILE_WLM = 'https://www.stereophile.com/content/wlm-diva';
const EVERSOLO_SITE = 'https://www.eversolo.com/Product/index/model/DMP-A6/target/7abWHw++oHhKKmVViAFMcQ==.html';
const GOLDMUND = 'https://www.goldmund.com/';

export const FRANCE_FACTS: ProductFact[] = [
  // ── Eversolo DMP-A6 ───────────────────────────────────────────────
  F('eversolo dmp-a6', 'parent_company', 'Zidoo', { sourceUrl: EVERSOLO_SHOP,
    quotedText: 'Zidoo is the parent company of Eversolo, and Eversolo is Zidoo’s pioneer in Hi-Fi audio.' }),
  F('eversolo dmp-a6', 'successor', 'DMP-A6 Gen 2', { sourceUrl: EVERSOLO_SHOP,
    qualifier: 'introduced January 2025' }),
  F('eversolo dmp-a6', 'range_position', 'A Master Edition sits above the standard model',
    { sourceUrl: EVERSOLO_SITE }),
  F('eversolo dmp-a6', 'brand_origin_country', 'China', { sourceClass: 'catalog' }),
  // Architecture below is published for the Gen 2 and is recorded AGAINST the
  // Gen 2, not back-applied to the model this listener owns.
  F('eversolo dmp-a6 gen 2', 'architecture_element', 'Dual ES9038Q2M DAC, one per channel',
    { sourceUrl: EVERSOLO_SHOP }),
  F('eversolo dmp-a6 gen 2', 'architecture_element', 'XMOS XU316 audio interface',
    { sourceUrl: EVERSOLO_SHOP }),
  F('eversolo dmp-a6 gen 2', 'architecture_element', 'Fully balanced from decoding to output',
    { sourceUrl: EVERSOLO_SHOP }),
  /*
   * ORIGINAL DMP-A6 specifications (acquired 2026-08-27). Eversolo replaced
   * its own DMP-A6 page in place with the Gen 2, so the live maker URL no
   * longer names the original — the same in-place replacement that
   * contaminated the held manufacturer rows (see FRANCE_SUPERSEDED_HELD_SPECS).
   * Audio46's page names "Gen 1 — Discontinued" explicitly, links the Gen 2
   * as a different product, and publishes the maker-supplied table for the
   * original. Third-party reported on purpose: the maker's own page for this
   * exact unit no longer exists.
   */
  F('eversolo dmp-a6', 'architecture_element',
    'Dual ES9038Q2M DACs in a double-differential configuration', {
      sourceClass: 'third_party_reported', state: 'reported', sourceUrl: AUDIO46_A6,
    }),
  F('eversolo dmp-a6', 'specification', '2.6V (RCA); 5.2V (XLR)', {
    qualifier: 'line output level', specRole: 'source_output',
    sourceClass: 'third_party_reported', state: 'reported', sourceUrl: AUDIO46_A6,
  }),
  F('eversolo dmp-a6', 'specification', '>124dB (RCA); >128dB (XLR)', {
    qualifier: 'dynamic range', specRole: 'other',
    sourceClass: 'third_party_reported', state: 'reported', sourceUrl: AUDIO46_A6,
  }),

  // ── JOB INTegrated ────────────────────────────────────────────────
  // Goldmund states the relationship in its own brand material; that makes the
  // RELATIONSHIP first-party even though JOB's own site does not carry it.
  F('job integrated', 'manufacturing_relationship',
    'JOB Electronics is Goldmund’s accessible sister brand, carrying the same design priorities at lower price points',
    { sourceUrl: GOLDMUND }),
  F('job integrated', 'brand_origin_country', 'Switzerland', { sourceClass: 'catalog' }),
  // Reported, not maker-published. Displayable; never calculable.
  F('job integrated', 'design_origin_country', 'Switzerland (Geneva)', {
    sourceClass: 'third_party_reported', state: 'reported',
    publication: 'Sound & Vision',
    sourceUrl: 'https://www.soundandvision.com/content/review-job-225-stereo-amplifier',
  }),
  F('job integrated', 'circuit_lineage',
    'Class AB topology derived from a late-1960s Tektronix oscilloscope circuit', {
      sourceClass: 'third_party_reported', state: 'reported',
      publication: 'Sound & Vision',
      sourceUrl: 'https://www.soundandvision.com/content/review-job-225-stereo-amplifier',
    }),
  /*
   * THE MAKER'S OWN BRIDGE (acquired 2026-08-27, archived maker page). JOB is
   * out of business and jobsys.com is gone; the Wayback capture of the
   * maker's own products page states, in the maker's words, that the
   * INTegrated "provides the latest circuit of power amp equivalent to a
   * JOB 225", and rates the 225 at 125W per channel. The 225's independent
   * bench measurement (Sound & Vision) sits in the review-evidence lane.
   * This figure belongs to the 225, not the INTegrated — specRole is
   * deliberately NOT amplifier_output, so no drive arithmetic may consume it.
   */
  F('job integrated', 'architecture_element',
    'Power-amplifier circuit the maker states is equivalent to the JOB 225, '
    + 'which the maker rates at 125W per channel', {
      sourceUrl: JOBSYS_ARCHIVE,
      qualifier: 'archived maker products page, captured 9 March 2016',
      quotedText: 'It provides the latest circuit of power amp equivalent to a JOB 225',
    }),
  F('job integrated', 'architecture_element',
    'Preamplifier section with USB input (DSD-capable), onboard D/A conversion '
    + 'to 384kHz, and an analogue line input', {
      sourceUrl: JOBSYS_ARCHIVE,
      qualifier: 'archived maker products page, captured 9 March 2016',
    }),

  // ── WLM Diva Monitor ──────────────────────────────────────────────
  F('wlm diva monitor', 'successor', 'Diva MK IV', {
    sourceUrl: 'https://www.wiener-lautsprecher-manufaktur.com/en-speaker',
    quotedText: 'Diva MK IV',
  }),
  F('wlm diva monitor', 'production_status', 'Superseded in WLM’s current range', {
    sourceUrl: 'https://www.wiener-lautsprecher-manufaktur.com/en-speaker',
  }),
  F('wlm diva monitor', 'brand_origin_country', 'Austria', { sourceClass: 'catalog' }),
  /*
   * Exact-product construction facts from Stereophile's RMAF 2008 report
   * (Stephen Mejias) — the only approved-publication coverage of the exact
   * Diva Monitor found. The sensitivity figure is the MAKER'S CLAIM AS
   * STEREOPHILE REPORTED IT ("is said to provide"), and the qualifier keeps
   * that distance; it is displayable and licenses hypothesis language only,
   * never established-headroom arithmetic. The aggregator figures (97dB,
   * 8 ohms) remain excluded — four Diva generations, no generation stated.
   */
  F('wlm diva monitor', 'architecture_element',
    'Front-ported two-way with a paper-cone coaxial drive unit and a rear '
    + 'tweeter-level control', {
      sourceClass: 'third_party_reported', state: 'reported',
      publication: 'Stereophile', sourceUrl: STEREOPHILE_WLM,
    }),
  F('wlm diva monitor', 'specification', '95dB', {
    qualifier: 'sensitivity — the maker\u2019s claim as reported by Stereophile '
      + '(RMAF 2008: \u201cis said to provide\u201d)',
    specRole: 'loudspeaker_sensitivity',
    sourceClass: 'third_party_reported', state: 'reported',
    publication: 'Stereophile', sourceUrl: STEREOPHILE_WLM,
  }),
];

/*
 * Held manufacturer rows whose provenance is no longer trustworthy for the
 * ORIGINAL product: the eversolo.com URLs they cite now serve the Gen 2 in
 * place, so nothing ties the cached figures to the unit this listener owns.
 * The store keeps the rows; the FRANCE dossiers stop showing them. The
 * authored facts above carry the original's figures with honest provenance.
 */
export const FRANCE_SUPERSEDED_HELD_SPECS: Record<string, string[]> = {
  'eversolo dmp-a6': ['frequency_response', 'power_output', 'dimensions'],
};

/**
 * Absences worth stating. `decisionRelevant` is what stops this becoming a
 * list of empty database fields: an unknown surfaces only where it blocks a
 * conclusion or a listener would reasonably expect to know it.
 *
 * The WLM sensitivity and impedance figures are ABSENT ON PURPOSE. Figures of
 * 97 dB and 8 ohms circulate widely, but the only source found is a spec
 * aggregator — ineligible under the type-③ policy, and for this product the
 * reason is concrete rather than procedural: WLM has shipped four Diva
 * generations, and an aggregator page headed "Diva" does not establish which.
 */
export const FRANCE_UNKNOWNS: UnknownField[] = [
  { predicate: 'specification', decisionRelevant: true,
    wouldCloseWith: 'JOB’s rated output for the INTegrated' },
  { predicate: 'manufacture_country', decisionRelevant: false },
];

export const FRANCE_UNKNOWN_BY_PRODUCT: Record<string, UnknownField[]> = {
  'job integrated': [{
    predicate: 'specification', decisionRelevant: true, quantity: 'amplifier_rated_output',
    wouldCloseWith: 'a rated output figure for the INTegrated itself — the maker rated '
      + 'only the 225, whose circuit it states the INTegrated shares',
  }],
  'wlm diva monitor': [{
    predicate: 'specification', decisionRelevant: true, quantity: 'speaker_load_profile',
    wouldCloseWith: 'a nominal impedance from WLM, and a maker-published sensitivity '
      + 'figure rather than the reported claim',
  }],
};
