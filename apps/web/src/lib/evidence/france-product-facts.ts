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

  // ── WLM Diva Monitor ──────────────────────────────────────────────
  F('wlm diva monitor', 'successor', 'Diva MK IV', {
    sourceUrl: 'https://www.wiener-lautsprecher-manufaktur.com/en-speaker',
    quotedText: 'Diva MK IV',
  }),
  F('wlm diva monitor', 'production_status', 'Superseded in WLM’s current range', {
    sourceUrl: 'https://www.wiener-lautsprecher-manufaktur.com/en-speaker',
  }),
  F('wlm diva monitor', 'brand_origin_country', 'Austria', { sourceClass: 'catalog' }),
];

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
    wouldCloseWith: 'a rated output figure from JOB — the amplifier’s side of the drive question',
  }],
  'wlm diva monitor': [{
    predicate: 'specification', decisionRelevant: true, quantity: 'speaker_load_profile',
    wouldCloseWith: 'sensitivity and nominal impedance from WLM — the loudspeaker’s side of the drive question',
  }],
};
