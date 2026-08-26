/**
 * Authored product facts — the Nathan reference system.
 *
 * Acquired 2026-08-26 in a targeted gap search: four interfaces in this chain
 * were unresolved not because the evidence is unobtainable but because nobody
 * had gone and got it. Each figure below was read from an exact-product source
 * and is recorded with the class of that source, because the classes differ
 * and the difference matters — one of these is a maker's claim, one is a
 * third party restating a maker's table, and one is an instrument reading
 * taken by a publication.
 *
 * WHAT THIS UNLOCKS. With output impedance on one side of an interface and
 * input impedance on the other, a loading relationship stops being unknown and
 * becomes arithmetic. That is the whole purpose of the relational layer, and
 * until now it had the rule and not the numbers.
 *
 * THE ONE FIGURE THAT DID NOT SURVIVE. A reference assessment supplied to the
 * founder gave the Reference 5's single-ended input impedance as 300k ohms.
 * Audio Research's own table says 60k. The figure was not imported on the
 * strength of being asserted, and it is recorded here as the maker states it.
 *
 * EXACT VARIANT, AGAIN. Audio Research's specification table gives frequency
 * response and gain separately for the Reference 5 and the Reference 5 SE, and
 * gives the impedances once. The impedances are recorded against the
 * Reference 5 — the product whose page this is — and nothing here is copied
 * from an SE source. The SE's own frequency-response figure (0.5Hz) is
 * explicitly NOT this product's (0.2Hz), which is how the variant confusion
 * in the held specifications was found.
 */
import type { ProductFact, UnknownField } from './product-dossier';

const ACORA = 'https://acoraacoustics.com/qrc-2-product-page/';
const BUTLER_MANUAL = 'https://butleraudio.com/pdf/a100manual.pdf';
const ARCDB = 'https://arcdb.ws/model/REF5';
const STEREOPHILE_MEASURED =
  'https://www.stereophile.com/content/dcs-rossini-apex-da-processor-measurements';

const F = (
  productKey: string,
  value: string,
  extra: Partial<ProductFact> = {},
): ProductFact => ({
  productKey, predicate: 'specification', value,
  sourceClass: 'maker_published', state: 'established', ...extra,
});

export const NATHAN_FACTS: ProductFact[] = [
  // ── Acora Acoustics QRC-2 ─────────────────────────────────────────
  // The sensitivity figure the review kept reporting as unpublished. It is
  // published, on the maker's own product page, and it is the number the
  // headroom question turns on.
  /*
   * The qualifier is doing real work here, not decorating. It becomes the
   * dossier LABEL, and a fact with none renders as "SPECIFICATION" — which is
   * how a published sensitivity figure sat in the dossier while the review
   * two inches above went on reporting it as unpublished. The label is what
   * the exact-field lookups match on.
   */
  F('acora qrc-2', '92.5dB', {
    unit: '1W/1m', specRole: 'loudspeaker_sensitivity', sourceUrl: ACORA,
    qualifier: 'sensitivity', quotedText: '92.5dB 1W/1M',
  }),
  /*
   * Impedance and power handling are deliberately ABSENT. Both were already
   * held, correctly and with proper labels; authoring them again produced a
   * dossier listing each twice — "4 ohms" above "4 ohm". Acquisition fills
   * gaps. A figure already on the page is not a gap, and re-authoring it is
   * how a dossier starts disagreeing with itself over spelling.
   */

  // ── Butler MONAD A100 ─────────────────────────────────────────────
  // From the maker's own manual, which is also where the amplifier's intended
  // operating arrangement is stated: "most applications will use at least a
  // pair of MONAD amplifiers".
  F('butler monad a100', '47K ohms', {
    specRole: 'other', sourceUrl: BUTLER_MANUAL,
    qualifier: 'input impedance, at each input (RCA and XLR)',
    quotedText: 'The input impedance is a very compliant 47K Ohms at each input '
      + 'to accept a wide range of signals without undue loading.',
  }),
  F('butler monad a100', '1.7 volts', {
    specRole: 'other', sourceUrl: BUTLER_MANUAL,
    qualifier: 'input sensitivity for full 100 watts output at 8 ohms',
    quotedText: 'The input gain has been internally preset to equal full (100 Watts) '
      + 'output at 8 ohms for an input sensitivity of 1.7 Volts.',
  }),

  // ── Audio Research Reference 5 ────────────────────────────────────
  // Audio Research's specification table, restated by an approved technical
  // reference rather than read from ARC's own live site, which no longer
  // carries a page for a preamplifier discontinued in 2012. Recorded as
  // third-party reported for exactly that reason.
  F('audio research reference 5', '600 ohms', {
    specRole: 'source_output', sourceClass: 'third_party_reported', sourceUrl: ARCDB,
    qualifier: 'output impedance, balanced; 300 ohms single-ended',
    quotedText: '600 ohms Balanced, 300 ohms SE main (2), 20K ohms minimum load '
      + 'and 2000pF maximum capacitance.',
  }),
  F('audio research reference 5', '120K ohms', {
    specRole: 'other', sourceClass: 'third_party_reported', sourceUrl: ARCDB,
    qualifier: 'input impedance, balanced; 60K ohms single-ended',
    quotedText: '120K ohms Balanced, 60K ohms SE',
  }),
  F('audio research reference 5', '20K ohms', {
    specRole: 'other', sourceClass: 'third_party_reported', sourceUrl: ARCDB,
    qualifier: 'minimum load the outputs are rated to drive',
  }),
  F('audio research reference 5', '12dB', {
    specRole: 'other', sourceClass: 'third_party_reported', sourceUrl: ARCDB,
    qualifier: 'gain, balanced output; 6dB single-ended',
  }),
  // The variant correction. ARC's table gives 0.2Hz for the Reference 5 and
  // 0.5Hz for the SE; the held specification carried the SE's figure.
  F('audio research reference 5', '+0 -3dB 0.2Hz to 200kHz', {
    specRole: 'other', sourceClass: 'third_party_reported', sourceUrl: ARCDB,
    qualifier: 'frequency response, at rated output, balanced, 200k ohms load — the Reference 5 figure; '
      + 'the Reference 5 SE is specified at 0.5Hz',
  }),

  // ── dCS Rossini Apex ──────────────────────────────────────────────
  // NOT a maker's figure. Stereophile put an instrument on the unit, and the
  // class says so — an independent measurement is a different kind of evidence
  // from a published specification, and merging them would hide which one this
  // conclusion rests on.
  F('dcs rossini apex', '2 ohms', {
    specRole: 'source_output', sourceClass: 'independently_measured',
    sourceUrl: STEREOPHILE_MEASURED, publication: 'Stereophile',
    qualifier: 'output impedance, balanced, measured 20Hz–20kHz; 51 ohms single-ended',
    quotedText: 'The balanced output impedance was an extraordinarily low 2 ohms '
      + 'from 20Hz to 20kHz.',
  }),
  F('dcs rossini apex', '6V / 2V / 0.6V / 0.2V', {
    specRole: 'other', sourceClass: 'independently_measured',
    sourceUrl: STEREOPHILE_MEASURED, publication: 'Stereophile',
    qualifier: 'selectable maximum balanced output; measured 5.95V, 2.014V, '
      + '594.7mV and 201.3mV respectively',
  }),
];

/**
 * What remains unheld, and would change the assessment.
 *
 * The impedance minimum and phase angle are the figures that separate "the
 * amplifier meets the nominal load" from "the amplifier finds this load easy",
 * and Acora does not publish them for any model.
 */
export const NATHAN_UNKNOWN_BY_PRODUCT: Record<string, UnknownField[]> = {
  'acora qrc-2': [
    {
      predicate: 'specification',
      decisionRelevant: true,
      wouldCloseWith: 'an impedance-magnitude and phase plot, which Acora does not '
        + 'publish and which no approved measurement of this model supplies',
    },
  ],
};

/**
 * Held specifications an authored fact CORRECTS, keyed by product.
 *
 * The Reference 5's held frequency response was Audio Research's figure for
 * the Reference 5 SE — 0.5Hz where the Reference 5 is specified at 0.2Hz. The
 * corrected fact alone was not enough: both then rendered, and a dossier
 * showing one product two ways is worse than one showing it wrongly once.
 *
 * Deliberately explicit rather than a general "authored beats held" rule.
 * Authored facts and held specifications usually complement each other, and a
 * blanket precedence would silently drop held evidence nobody had reviewed.
 * Each entry here is a correction somebody checked against the maker's table.
 */
export const NATHAN_SUPERSEDED_HELD_SPECS: Record<string, string[]> = {
  'audio research reference 5': ['frequency_response'],
  /*
   * The held sensitivity was stored as "92.5 1w/1m" — the number without its
   * unit. It rendered beside the authored "92.5dB 1W/1m" as a second,
   * near-identical line, and because it carries no dB it parsed as no
   * decibels at all: the headroom conclusion silently declined to compute,
   * on a figure the dossier was displaying two inches above.
   */
  'acora qrc-2': ['sensitivity'],
};
