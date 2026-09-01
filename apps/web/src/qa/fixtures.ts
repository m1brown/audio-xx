/**
 * Audio XXI — Regression fixture suite.
 *
 * Deterministic, representative systems exercised by the automated regression
 * workflow (see apps/web/scripts/qa-regression.mts). Each fixture is a plain
 * system-assessment request plus optional explicit intent. The suite is the
 * single source of truth for BOTH the engine-text snapshot (Tier A) and the
 * browser visual snapshot (Tier B), so the two tiers always cover the same
 * systems.
 *
 * Design rules:
 *   - Text-driven only (resolved through the live catalog), no hand-built
 *     product objects, so a fixture stays valid as catalog data evolves and a
 *     resolution failure is itself a meaningful regression.
 *   - Each fixture targets a distinct engine path (intent-aligned demotion,
 *     counter-direction, no-intent, coherent voicing, capability constraint,
 *     reference tier, …) so a behavioural change surfaces somewhere.
 *   - Adding a fixture is a one-line append — the suite is meant to grow to
 *     dozens or hundreds without touching the runner.
 *
 * `desires` is the user's explicit intent (DesireSignal[]). Keep it minimal and
 * canonical (quality tokens from intent.ts KNOWN_QUALITIES).
 */

export interface QaFixture {
  /** Stable slug — also the snapshot/screenshot filename. Never reuse. */
  id: string;
  /** Human label for the report. */
  label: string;
  /** Coarse grouping for the report. */
  category:
    | 'intent_aligned'
    | 'intent_opposed'
    | 'no_intent'
    | 'coherent_voicing'
    | 'capability_constraint'
    | 'reference_tier'
    | 'general';
  /** The system, as the user would type it. */
  systemText: string;
  /** Explicit user intent, if any. */
  desires?: Array<{ quality: string; direction: 'more' | 'less' }>;
  /** One line on what this fixture is meant to pin down. */
  note: string;
}

export const QA_FIXTURES: QaFixture[] = [
  {
    id: 'warm-tube-jbl--wants-warmth',
    label: 'Warm system · wants warmth',
    category: 'intent_aligned',
    systemText: 'Assess my system: Schiit Bifrost 2/64, Marantz 2220B, JBL L100 Classic',
    desires: [{ quality: 'warmth', direction: 'more' }],
    note: 'P3 — preference-relative bottleneck whose lean the user wants → Optional Direction.',
  },
  {
    id: 'warm-tube-jbl--wants-detail',
    label: 'Warm system · wants detail',
    category: 'intent_opposed',
    systemText: 'Assess my system: Schiit Bifrost 2/64, Marantz 2220B, JBL L100 Classic',
    desires: [{ quality: 'detail', direction: 'more' }],
    note: 'P2 — intent opposes the lean → counter-direction stays Highest Impact.',
  },
  {
    id: 'detailed-hegel-jbl--wants-detail',
    label: 'Detailed system · wants detail',
    category: 'intent_aligned',
    systemText: 'Assess my system: Topping D90SE, Hegel H190, JBL L100 Classic',
    desires: [{ quality: 'detail', direction: 'more' }],
    note: 'P3/P5 — detail bottleneck + limitation reframed as accepted trade-off.',
  },
  {
    id: 'detailed-hegel-jbl--wants-flow',
    label: 'Detailed system · wants flow',
    category: 'intent_opposed',
    systemText: 'Assess my system: Topping D90SE, Hegel H190, JBL L100 Classic',
    desires: [{ quality: 'flow', direction: 'more' }],
    note: 'P2/P5 — flow intent opposes detail lean; detail limitation stays a limitation.',
  },
  {
    id: 'bright-kef--no-intent',
    label: 'Bright analytical system · no intent',
    category: 'no_intent',
    systemText: 'Assess my system: Topping D90SE, Hegel H190, KEF R3',
    note: 'No-intent baseline — no tonal direction asserted.',
  },
  {
    id: 'warm-tube-jbl--no-intent',
    label: 'Warm system · no intent',
    category: 'no_intent',
    systemText: 'Assess my system: Schiit Bifrost 2/64, Marantz 2220B, JBL L100 Classic',
    note: 'No-intent control on the warm chain.',
  },
  {
    id: 'boutique-denafrips-naim-devore',
    label: 'Boutique warm — coherent voicing',
    category: 'coherent_voicing',
    systemText: 'Assess my system: Denafrips Terminator II, Naim SuperNait 3, DeVore O/96',
    note: 'Coherence gate — deliberate voicing, no bottleneck promotion.',
  },
  {
    id: 'harbeth-naim-qutest',
    label: 'Harbeth + Naim + Qutest',
    category: 'general',
    systemText: 'Assess my system: Chord Qutest, Naim SuperNait 3, Harbeth Super HL5 Plus',
    note: 'Classic mid-fi reference chain — general assessment shape.',
  },
  {
    id: 'magnepan-lowpower',
    label: 'Magnepan LRS+ on low power',
    category: 'capability_constraint',
    systemText: 'Assess my system: Holo May (KTE), Decware SE84UFO, Magnepan LRS+',
    note: 'Capability (power) constraint — stays Highest Impact regardless of intent.',
  },
  {
    id: 'analytical-benchmark-lsmeta',
    label: 'Benchmark + KEF LS50 Meta — analytical',
    category: 'general',
    systemText: 'Assess my system: Topping D70 Pro SABRE, Benchmark AHB2, KEF LS50 Meta',
    note: 'Fully analytical chain — stacked-detail behaviour.',
  },
];
