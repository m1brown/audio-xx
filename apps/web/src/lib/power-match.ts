/**
 * Amplifier / loudspeaker power matching — the one classifier.
 *
 * Lifted out of consultation.ts so the deterministic assessment and the
 * provisional (model-assisted) assessment reach the SAME arithmetic from the
 * same figures. They did not: the deterministic path computed the headroom
 * ceiling and stated it, while the provisional path handed the model two
 * published numbers and left it to do the sum — on exactly the systems where
 * both components are uncatalogued and the provisional path is the one that
 * runs. Two derivations of one physical relation is how a listener gets a
 * different answer depending on which components we happen to have curated.
 *
 * Domain layer, deliberately: watts, dB and SPL are audio facts, not engine
 * primitives. Nothing here reads an EvidenceItem or a SystemComponent — it
 * takes two numbers and returns a classification, so the evidence layer never
 * has to know what an amplifier is.
 *
 * The model is simplified on purpose (anechoic, no room gain): a directional
 * signal, not a prediction. Impedance is deliberately NOT modelled — derating
 * for a difficult load is a second compatibility engine and a rule nobody has
 * established here.
 */

export type PowerMatchCompatibility =
  'optimal' | 'adequate' | 'strained' | 'mismatched' | 'unknown';

export interface PowerMatchClassification {
  compatibility: PowerMatchCompatibility;
  /** sensitivity_db + 10*log10(power_watts). Null whenever either input is absent. */
  estimatedMaxCleanSPL: number | null;
}

/**
 * Classify the power match between an amp and a speaker.
 *
 * @param powerWatts    Amp power output in watts (null if unknown)
 * @param sensitivityDb Speaker sensitivity in dB (null if unknown)
 */
export function classifyPowerMatch(
  powerWatts: number | null,
  sensitivityDb: number | null,
): PowerMatchClassification {
  if (powerWatts == null || sensitivityDb == null || powerWatts <= 0) {
    return { compatibility: 'unknown', estimatedMaxCleanSPL: null };
  }

  const estimatedSPL = sensitivityDb + 10 * Math.log10(powerWatts);

  if (estimatedSPL >= 100) return { compatibility: 'optimal', estimatedMaxCleanSPL: estimatedSPL };
  if (estimatedSPL >= 95)  return { compatibility: 'adequate', estimatedMaxCleanSPL: estimatedSPL };
  if (estimatedSPL >= 90)  return { compatibility: 'strained', estimatedMaxCleanSPL: estimatedSPL };
  return { compatibility: 'mismatched', estimatedMaxCleanSPL: estimatedSPL };
}

/**
 * The one sentence stating what the pairing can do, or null when we cannot say.
 *
 * Used by the provisional path, which had no wording of its own. The
 * deterministic path still composes its own sentence inside its constraint
 * prose; the CLASSIFIER is what both share, so the two can differ in phrasing
 * but never in verdict or figure.
 *
 * 'unknown' returns null: a pairing we cannot assess gets no sentence at all,
 * never a reassuring one.
 */
export function powerMatchStatement(
  ampName: string,
  speakerName: string,
  powerWatts: number | null,
  sensitivityDb: number | null,
): string | null {
  const { compatibility, estimatedMaxCleanSPL } = classifyPowerMatch(powerWatts, sensitivityDb);
  if (compatibility === 'unknown' || estimatedMaxCleanSPL == null) return null;
  const spl = Math.round(estimatedMaxCleanSPL);
  const head = `${ampName} at ${powerWatts}W into ${speakerName} at ${sensitivityDb} dB sensitivity `
    + `gives an estimated ${spl} dB maximum clean output`;
  switch (compatibility) {
    case 'optimal':
      return `${head} — ample headroom for normal listening levels.`;
    case 'adequate':
      return `${head} — comfortable at normal levels, limited on peaks.`;
    case 'strained':
      return `${head} — dynamics will compress at moderate levels.`;
    case 'mismatched':
      return `${head} — below comfortable listening levels for dynamic music.`;
  }
}
