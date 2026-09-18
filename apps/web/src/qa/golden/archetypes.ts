/**
 * Golden System Conversations — the four archetypes.
 *
 * These are the four systems from the Post-M1 Product Acceptance
 * (2026-09-17, release ca1f5a7, generation gpt-6-astra, validator gpt-4o).
 * Each is retained because it stresses a DIFFERENT part of the adviser.
 *
 * WHAT IS GOLDEN HERE IS BEHAVIOR, NOT ANSWERS. A future model may use
 * different words or reach a different appropriately-supported
 * recommendation and still be excellent. The corpus detects regression in
 * the QUALITY OF REASONING — it must never turn Audio XX back into a
 * deterministic rules engine.
 */

/** Which frozen-evidence ExperimentSystem the archetype runs on. */
export interface GoldenArchetype {
  /** ExperimentSystem id in qa/vnext/frozen-evidence.ts */
  systemId: 'france-ii' | 'nathan' | 'nad' | 'accuphase';
  title: string;
  /** What this archetype exists to stress. */
  stresses: string[];
  /** Reference behaviors from the accepted acceptance run — exemplars,
   *  NEVER required outputs. */
  acceptedBehaviors: string[];
  /** Failure patterns this archetype should surface. */
  watchFor: string[];
}

export const GOLDEN_ARCHETYPES: GoldenArchetype[] = [
  {
    systemId: 'france-ii',
    title: 'France II — decision value under attachment and budget',
    stresses: [
      'boutique / less-uniformly-documented equipment',
      'incomplete exact-product evidence with bounded model knowledge',
      'multiple DAC paths through one system',
      'system coherence and speaker substitution',
      'a stated budget that is a ceiling, not a spending target',
      'listener attachment / intimacy language',
      'specific candidate recommendations',
      'willingness not to spend',
    ],
    acceptedBehaviors: [
      'useful DAC comparison protocol',
      'Boenicke W5 handled as hypothetical without mutating the roster',
      'listener observation changed the recommendation',
      '$5k treated as ceiling rather than spending target',
      'candidates tied to the actual system',
      'final restraint',
    ],
    watchFor: [
      'automatic budget exhaustion',
      'generic $5k shopping list',
      'unrelated famous components',
      'unsupported numeric claims',
      'recommendation disconnected from the prior conversation',
    ],
  },
  {
    systemId: 'nathan',
    title: 'Nathan — high-end restraint and interface reasoning',
    stresses: [
      'genuinely high-end system with strong exact technical evidence',
      'electrical/interface reasoning and gain structure',
      'system coherence among expensive components',
      'upgrade/status bias resistance',
      'listener preference producing a recommendation reversal',
      'justified restraint',
    ],
    acceptedBehaviors: [
      'reasoning across Rossini / ARC / Butler / Acora interfaces',
      'free Rossini-direct experiment before any purchase',
      'electrical redundancy recognized as not automatically musical redundancy',
      'listener preference materially changed the recommendation',
      'justified "do nothing"',
    ],
    watchFor: [
      'expensive system → recommend a more expensive component, without a listener/system reason',
      'technically possible improvement treated as justified purchase',
      'interface reasoning replaced by product reputation',
    ],
  },
  {
    systemId: 'nad',
    title: 'NAD — heterogeneous architecture without age/price heuristics',
    stresses: [
      'AVR + external DAC + vintage speakers',
      'signal routing and uncertainty about internal processing',
      'resisting status/price/age heuristics',
      'modernization vs preservation',
      'specific candidate generation under sparse evidence',
    ],
    acceptedBehaviors: [
      'checked whether the analogue input is re-digitized',
      'asked about listening mode/input',
      'treated the Dynaco A35 as a system variable, not an old thing',
      'explicitly rejected "replace the oldest"',
      'listener context reduced the importance of power',
    ],
    watchFor: [
      '"replace the oldest/cheapest component" reasoning',
      'invented exact attributes on suggested candidates (the historical P2: two useful candidate drafts each carried an unlicensed numeric attribute, the trust net rejected both, and the listener received a safe failure — trust PASS, product-quality degradation)',
      'skipping the routing question and assessing a chain it has not established',
    ],
  },
  {
    systemId: 'accuphase',
    title: 'Accuphase — sparse evidence must not make the model stupid',
    stresses: [
      'mature coherent system with sparse-to-moderate evidence',
      'amplifier/speaker power reasoning from a licensed ladder',
      'brand-mythology resistance',
      'substitution curiosity',
      'low-level / close-seat listener context',
      'restraint as the strongest answer',
    ],
    acceptedBehaviors: [
      'licensed power ladder used correctly',
      'no invented Harbeth impedance curve',
      'no "matching Accuphase sounds better" mythology',
      'bottleneck reframed around the actual listener experience',
      'Luxman treated as audition rather than predetermined upgrade',
      'final recommendation to leave the system intact',
    ],
    watchFor: [
      '"insufficient evidence" used to stop the conversation instead of bounding it',
      'model knowledge silently presented as verified Audio XX fact',
      'brand-loyalty or matching-brand mythology',
    ],
  },
];

export const GOLDEN_SYSTEM_IDS = GOLDEN_ARCHETYPES.map((a) => a.systemId);
