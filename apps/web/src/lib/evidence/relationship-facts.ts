/**
 * Relationship-first authored facts (2026-09-11).
 *
 * SCOPE: evidence acquired because a MATERIAL SYSTEM RELATIONSHIP named it —
 * never because a dossier looked thin. Each entry answers: which unresolved
 * relationship does this bear on, and what claim does it license? The
 * Boenicke control's assessment itself named the gaps ("whether the
 * amplifier is a limiting factor turns on the JOB INTegrated's rated
 * output, the Boenicke W5's sensitivity and its nominal impedance"); this
 * file closes what the record can close and names, with `wouldCloseWith`,
 * what it cannot.
 *
 * Acquisition notes (browsed and quoted 2026-09-11):
 *  - boenicke-audio.ch's W5 page publishes sensitivity and nominal
 *    impedance under "TechTalk". The page carries the MK2 designation, so a
 *    revision fact records that the figures are the maker's CURRENT ones —
 *    the exact-variant lesson of the Eversolo Gen-2 page, stated instead of
 *    silently absorbed.
 *  - The archived maker technical page for the JOB 225 (the model whose
 *    power-amplifier circuit the maker states the INTegrated shares) rates
 *    it at 125W/8Ω nominal and 200W/8Ω RMS. Those figures belong to the
 *    225: predicate is architecture_element, NOT a specification with
 *    specRole amplifier_output, so no drive arithmetic may consume them —
 *    the same deliberate non-calculability as the existing family bridge.
 *  - No maker rating for the INTegrated itself exists anywhere in the
 *    archived record; that absence stays an UnknownField, not a guess.
 */
import type { ProductFact, UnknownField } from './product-dossier';
import { FRANCE_FACTS, FRANCE_UNKNOWN_BY_PRODUCT } from './france-product-facts';
import { NATHAN_FACTS, NATHAN_UNKNOWN_BY_PRODUCT } from './nathan-product-facts';

const F = (
  productKey: string,
  predicate: ProductFact['predicate'],
  value: string,
  extra: Partial<ProductFact> = {},
): ProductFact => ({
  productKey, predicate, value,
  sourceClass: 'maker_published', state: 'established', ...extra,
});

const BOENICKE_W5 = 'https://boenicke-audio.ch/products/loudspeakers/w5/';
const JOB225_TECH = 'https://web.archive.org/web/20170413154118/http://jobsys.com/job225doc.htm';

export const RELATIONSHIP_FACTS: ProductFact[] = [
  // ── Boenicke W5 ───────────────────────────────────────────────────
  // Bears on: JOB INTegrated → W5, the relationship the assessment names as
  // the system's likely practical ceiling. Licenses: the loudspeaker's side
  // of the drive question — how loud it plays per watt, and what load it
  // presents nominally. Does NOT license: any claim about how it sounds.
  F('boenicke w5', 'specification', '83–86dB/W/m (varying with frequency)', {
    qualifier: 'sensitivity', specRole: 'loudspeaker_sensitivity',
    sourceUrl: BOENICKE_W5,
    quotedText: 'Sensitivity: 83-86 dB / watt / m depending on frequency',
  }),
  F('boenicke w5', 'specification', '4 ohms', {
    qualifier: 'nominal impedance', specRole: 'loudspeaker_load',
    sourceUrl: BOENICKE_W5,
    quotedText: 'Nom. impedance: 4 ohms',
  }),
  // Load-relevant topology: a long-throw driver in a very small sealed
  // volume is the mechanism BEHIND the low sensitivity — the maker's own
  // figures, recorded because they explain the demand, not to praise it.
  F('boenicke w5', 'architecture_element',
    'Bass driver with 18.5mm linear excursion working into a 2.8-litre enclosure volume', {
      sourceUrl: BOENICKE_W5,
      quotedText: 'This little beast of a bass driver is capable of 18.5 mm linear excursion. '
        + 'You have to hear to believe how much punchy bass it can generate from a 2.8 L volume.',
    }),
  F('boenicke w5', 'architecture_element',
    'Miniature rear ambient tweeter; the maker emphasises its off-axis response', {
      sourceUrl: BOENICKE_W5,
    }),
  // Exact-variant honesty (the Eversolo lesson, stated not silently absorbed):
  F('boenicke w5', 'range_position',
    'The maker’s current W5 page carries the MK2 designation; the figures recorded '
    + 'here are the maker’s current published figures for the W5', {
      sourceUrl: BOENICKE_W5,
    }),

  // ── JOB INTegrated — family technical reference ───────────────────
  // Bears on: JOB INTegrated → W5. Licenses: conditional context about the
  // circuit the maker states the INTegrated shares. Never calculable: the
  // figures are the 225's, and predicate keeps them out of drive arithmetic.
  F('job integrated', 'architecture_element',
    'Maker technical data for the JOB 225 — the model whose power-amplifier circuit '
    + 'the maker states the INTegrated shares — rates it at 125W per channel into '
    + '8 ohms nominal, 200W per channel RMS into 8 ohms on the Goldmund FPP standard', {
      sourceUrl: JOB225_TECH,
      qualifier: 'archived maker technical page for the JOB 225, captured 13 April 2017',
      quotedText: 'Nominal Power: 125W on 8 Ohms per channel … Power RMS (Goldmund FPP '
        + 'Standard): 200W on 8 Ohms each channel at nominal AC line voltage',
    }),
];

/**
 * Decision-relevant absences. Each entry is an evidence NEED the Explain
 * layer has named: component, blocked relationship, and what would close it.
 */
export const RELATIONSHIP_UNKNOWN_BY_PRODUCT: Record<string, UnknownField[]> = {
  'boenicke w5': [{
    predicate: 'specification', decisionRelevant: true, quantity: 'speaker_impedance_curve',
    wouldCloseWith: 'an impedance/phase plot for the W5 — the maker publishes nominal '
      + 'impedance only, and how far the real load dips below 4 ohms decides how much '
      + 'current the amplifier must actually deliver',
  }],
  'nad av716': [{
    predicate: 'specification', decisionRelevant: true, quantity: 'amplifier_rated_output',
    wouldCloseWith: 'NAD’s rated output for the AV716 from its manual or archived '
      + 'maker literature — without it the receiver’s side of the drive question '
      + 'cannot be assessed',
  }],
  'dynaco a35': [{
    predicate: 'specification', decisionRelevant: true, quantity: 'speaker_load_profile',
    wouldCloseWith: 'sensitivity and nominal impedance from Dynaco’s own literature '
      + '(period brochures survive in archives); the third-party source held covers '
      + 'dimensions and weight only',
  }],
};

/**
 * ONE merge, consumed by every dossier-building surface — the conversation,
 * the computed-facts lane and the server/artifact route read the same
 * authored record, so a fact admitted for a relationship cannot be visible
 * on one surface and absent on another (which is exactly what happened to
 * the JOB conversion-topology fact before this file existed).
 */
export const AUTHORED_FACTS: ProductFact[] = [
  ...FRANCE_FACTS, ...NATHAN_FACTS, ...RELATIONSHIP_FACTS,
];

export const AUTHORED_UNKNOWN_BY_PRODUCT: Record<string, UnknownField[]> = {
  ...FRANCE_UNKNOWN_BY_PRODUCT,
  ...NATHAN_UNKNOWN_BY_PRODUCT,
  ...RELATIONSHIP_UNKNOWN_BY_PRODUCT,
};

/**
 * The authored record as evidence items for the model lane (convergence,
 * 2026-09-11). The provisional prompt's evidence feed was a store fetch
 * alone, so a fact admitted in this file could narrow the composed review
 * while the model reasoned as if it did not exist — two evidence universes
 * on one page. Only calculation-grade specification facts cross (maker or
 * independently measured, established, quoted): the same admission bar the
 * deterministic lane applies before arithmetic.
 */
export function authoredEvidenceItems(
  displayNames: string[],
  keyFor: (name: string) => string,
): Array<{
  productKey: string; evidenceClass: 'manufacturer'; tier: 'manufacturer';
  scope: 'product'; field: string; value: string;
  attribution?: { sourceUrl: string; quotedText: string }; retrievedAt: number;
}> {
  const keys = new Map(displayNames.map((n) => [keyFor(n), n] as const));
  return AUTHORED_FACTS
    .filter((f) => keys.has(f.productKey)
      && f.predicate === 'specification'
      && f.state === 'established'
      && f.sourceClass === 'maker_published'
      && !!f.qualifier && !!f.sourceUrl && !!f.quotedText)
    .map((f) => ({
      productKey: f.productKey,
      evidenceClass: 'manufacturer' as const,
      tier: 'manufacturer' as const,
      scope: 'product' as const,
      field: (f.qualifier as string).replace(/\s+/g, '_').toLowerCase(),
      value: f.value,
      attribution: { sourceUrl: f.sourceUrl as string, quotedText: f.quotedText as string },
      retrievedAt: 0,
    }));
}
