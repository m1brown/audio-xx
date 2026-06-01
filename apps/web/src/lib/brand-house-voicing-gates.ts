/**
 * Audio XX — Brand House Voicing gate stack (Phase E-5B.2 — §5 only).
 *
 * Sits between {@link findBrandHouseVoicing} (Stage E-5B.1 data layer)
 * and the §5 composer integration in
 * `apps/web/src/components/advisory/SystemAssessmentArtifact.tsx`.
 *
 * Implements the §5-only gate stack documented in
 * `docs/phase-E-5B-implementation-design.md` §4, with the Stage E-5B.2
 * conflict-signal hardening: ANY conflict signal suppresses brand
 * voicing in §5 (not only medium-confidence entries). This is stricter
 * than the design doc's medium-only rule and is the explicit Stage
 * E-5B.2 specification.
 *
 * Architectural commitments inherited from E-5A §1A Brand Layer
 * Philosophy:
 *   1. Selection-only — the helper returns one of the entry's static
 *      strings verbatim. It never generates novel prose.
 *   2. Suppression is final — once any gate fires, the result is null.
 *      The implementation does NOT retry the same sentence with
 *      modifications. The priority order across `houseVoicing` →
 *      `designPhilosophy` → `systemBuildingLogic` is a fall-through to
 *      the next FIELD when the prior is unset or fails its checks;
 *      this is distinct from retrying with a "weaker" variant of the
 *      same field, which is what the user spec forbids.
 *   3. Architecture-produces-behavior — every surfaced sentence must
 *      contain at least one engineering anchor token (Gate #11). A
 *      sentence that names a behavior without naming the design choice
 *      that produces it is a restraint failure and is suppressed.
 *
 * No state, no side effects, no logging. Given the same input the
 * helper returns the same result.
 */

import {
  BRAND_HOUSE_VOICING,
  UNIVERSAL_AVOID_OVERCLAIMING,
  findBrandHouseVoicing,
  type BrandHouseVoicing,
  type RoleFamily,
} from './brand-house-voicing';

// ─── Public types ────────────────────────────────────────────────────

/**
 * Inputs to the §5 gate stack. Every field is the caller's
 * responsibility; the helper does not derive any of them from data
 * outside this argument object.
 */
export interface BrandGateInputFor5 {
  /** Component display name (mixed-case OK). */
  componentName: string;
  /**
   * Component role family — derived via the existing
   * `roleFamily(role)` helper in SystemAssessmentArtifact. Headphone
   * components fall under `'speaker'`; auxiliaries (PSU / clock /
   * network) fall under `'auxiliary'` (and the caller should skip the
   * helper entirely for those — see {@link selectBrandHouseVoicingSentenceForComponent}).
   */
  roleFamily: RoleFamily | 'unknown';
  /**
   * Phase A B3/B4 chain-level conflict-signal flag. When true, the
   * §5 brand sentence is suppressed regardless of entry confidence
   * (Stage E-5B.2 hardening — stricter than the design doc's
   * medium-only rule).
   */
  hasConflictSignal: boolean;
  /**
   * Phase A B5 primary-constraint flag. When true (i.e. this component
   * is the engine's primary upgrade constraint), the §5 brand sentence
   * is suppressed so the brand layer cannot contradict the engine's
   * upgrade direction.
   */
  isPrimaryConstraint: boolean;
  /**
   * The §5 card body composed up to the brand-sentence insertion point
   * (existing facts / contribution prose). Used for redundancy
   * suppression — if a candidate sentence's key engineering noun-phrase
   * is already present in the existing prose, the brand sentence is
   * suppressed.
   */
  existingCardProse: string;
}

/**
 * Outcome of running the §5 gate stack.
 *
 * `sentence === null` whenever any gate fires. The `suppressedBy`
 * field names the first gate that prevented surfacing. Callers that
 * only need the prose can read `sentence` and ignore the diagnostic.
 */
export interface BrandGateResultFor5 {
  sentence: string | null;
  suppressedBy?:
    | 'no-match'
    | 'commercial'
    | 'confidence-low'
    | 'role-not-applicable'
    | 'conflict-signal'
    | 'primary-constraint'
    | 'no-candidate-field'
    | 'redundancy'
    | 'avoid-overclaim-match'
    | 'shape-check-failed';
}

// ─── Private hint tables ─────────────────────────────────────────────

/**
 * Redundancy key-phrase hint table (E-5B §4.4). Per-brand list of
 * noun-phrase tokens that should suppress the candidate sentence when
 * any of them is ALREADY present in `existingCardProse`.
 *
 * Implementation detail — private to this module. The hint set is
 * derivable from each entry's `houseVoicing` / `designPhilosophy` and
 * does not extend the public `BrandHouseVoicing` schema. Maintenance
 * is routine: if a new entry's voicing field references additional
 * engineering vocabulary that could appear in §5 facts prose, add
 * those tokens here.
 *
 * Keys are the entry's `brand` field exactly. Lookup is exact-match,
 * not substring.
 */
const REDUNDANCY_KEY_PHRASES: Readonly<Record<string, readonly string[]>> = {
  'Audio Research': ['auto-bias', 'Reference series'],
  'Chord Electronics': ['FPGA'],
  'dCS': ['Ring DAC', 'FPGA'],
  'DeVore Fidelity': ['wide-baffle', 'high efficiency', 'high-efficiency'],
  'Focal': ['inverted dome', 'inverted-dome', 'beryllium tweeter'],
  'Harbeth': ['RADIAL', 'thin-wall'],
  'Hegel Music Systems': ['SoundEngine'],
  'JBL Studio Monitor & Synthesis': ['compression driver', 'horn'],
  'KEF': ['Uni-Q'],
  'Klipsch Heritage': ['horn', 'high efficiency', 'high-efficiency'],
  'Leben Hi-Fi': ['push-pull', 'EL84', '6L6GC', '6CA7'],
  'Linn Products': ['source-first', 'Space Optimisation'],
  'Luxman': ['Class-AB', 'high-bias'],
  'Magico': ['aluminum-extrusion', 'sealed cabinet'],
  'McIntosh': ['autoformer', 'unity-coupled'],
  'Naim Audio': ['discrete signal path', 'power-supply', 'power supply'],
  'Pass Labs': ['Class-A', 'Nelson Pass'],
  'Quad': ['electrostatic', 'dipole'],
  'Rega': ['cross-component', 'ecosystem'],
  'Spendor': ['BBC heritage', 'sealed cabinet', 'thin-wall'],
  'Tannoy': ['Dual-Concentric', 'Dual Concentric'],
  'Wilson Audio Specialties': ['X-Material', 'time-aligned'],
  'YG Acoustics': ['BilletCore', 'sealed cabinet'],
};

/**
 * Architecture-anchor vocabulary for the Gate #11 shape check. A
 * candidate sentence must contain at least one of these substrings
 * (case-insensitive) to surface; otherwise it is flagged as
 * "brand sounds like X" without naming the design choice that produces
 * the behavior, and suppressed.
 *
 * The list is editorially stable and grown only with reviewed
 * additions. Adding generic vocabulary here weakens the gate.
 *
 * Tokens cover:
 *   - General design / engineering vocabulary
 *   - Brand-specific trademark architecture names
 *   - System-building / ecosystem vocabulary that ties presentation
 *     to a within-brand engineering choice
 */
const ARCHITECTURE_ANCHORS: readonly string[] = [
  // Generic design / engineering vocabulary
  'design',
  'topology',
  'architecture',
  'cabinet',
  'driver',
  'tube',
  'transformer',
  'panel',
  'coaxial',
  'dipole',
  'sealed',
  'horn',
  'discrete',
  'signal path',
  'power supply',
  'power-supply',
  'feedback',
  'output',
  'topology',
  'lineage',
  'output stage',
  'output-stage',
  // Specific topologies / classes
  'class-a',
  'class-ab',
  'set ',
  'push-pull',
  'auto-bias',
  // Brand-specific trademark architectures
  'fpga',
  'ring dac',
  'uni-q',
  'dual-concentric',
  'dual concentric',
  'autoformer',
  'unity-coupled',
  'inverted dome',
  'inverted-dome',
  'radial',
  'billetcore',
  'x-material',
  'soundengine',
  // System-building / ecosystem vocabulary
  'cross-component',
  'source-first',
  'ecosystem',
  // Material / driver geometry
  'aluminum',
  'aluminium',
  'beryllium',
  'electrostatic',
  'compression driver',
  'wide-baffle',
  'wide baffle',
  'thin-wall',
  'high efficiency',
  'high-efficiency',
];

// ─── Internal helpers ────────────────────────────────────────────────

function rolesInclude(
  appliesToRoles: readonly RoleFamily[],
  roleFamily: RoleFamily | 'unknown',
): boolean {
  if (appliesToRoles.includes('all')) return true;
  if (roleFamily === 'unknown') return false;
  return appliesToRoles.includes(roleFamily);
}

function findRedundantHint(
  entry: BrandHouseVoicing,
  candidate: string,
  existingCardProse: string,
): boolean {
  const hints = REDUNDANCY_KEY_PHRASES[entry.brand];
  if (!hints) return false;
  const candidateLower = candidate.toLowerCase();
  const existingLower = existingCardProse.toLowerCase();
  for (const hint of hints) {
    const hintLower = hint.toLowerCase();
    if (
      candidateLower.includes(hintLower) &&
      existingLower.includes(hintLower)
    ) {
      return true;
    }
  }
  return false;
}

function containsAnyDeniedPhrase(
  candidate: string,
  entry: BrandHouseVoicing,
): boolean {
  const candidateLower = candidate.toLowerCase();
  for (const phrase of entry.avoidOverclaiming) {
    if (candidateLower.includes(phrase.toLowerCase())) return true;
  }
  for (const phrase of UNIVERSAL_AVOID_OVERCLAIMING) {
    if (candidateLower.includes(phrase.toLowerCase())) return true;
  }
  return false;
}

function hasArchitectureAnchor(candidate: string): boolean {
  const candidateLower = candidate.toLowerCase();
  for (const anchor of ARCHITECTURE_ANCHORS) {
    if (candidateLower.includes(anchor.toLowerCase())) return true;
  }
  return false;
}

/**
 * Try one candidate field against the post-selection gates (redundancy,
 * anti-overclaim, shape). Returns the candidate when all gates pass,
 * or a typed suppression reason for the first gate that fires.
 *
 * Caller is responsible for iterating the priority order
 * (`houseVoicing` → `designPhilosophy` → `systemBuildingLogic`).
 */
function evaluateCandidate(
  candidate: string,
  entry: BrandHouseVoicing,
  existingCardProse: string,
):
  | { ok: true; sentence: string }
  | {
      ok: false;
      reason: 'redundancy' | 'avoid-overclaim-match' | 'shape-check-failed';
    } {
  if (findRedundantHint(entry, candidate, existingCardProse)) {
    return { ok: false, reason: 'redundancy' };
  }
  if (containsAnyDeniedPhrase(candidate, entry)) {
    return { ok: false, reason: 'avoid-overclaim-match' };
  }
  if (!hasArchitectureAnchor(candidate)) {
    return { ok: false, reason: 'shape-check-failed' };
  }
  return { ok: true, sentence: candidate };
}

// ─── Pre-pass eligibility helper (Phase E-5B.2A dedup) ──────────────

/**
 * Phase E-5B.2A — return the brand entry that WOULD surface for the
 * given component if the §5 integration site invoked the full selector,
 * subject only to the pre-selection gates (lookup + commercial +
 * confidence-low + role applicability). Conflict-signal, primary-
 * constraint, redundancy, anti-overclaim, and shape-check gates are
 * NOT applied — those depend on the existing card prose and chain
 * context that the dedup pre-pass does not yet have.
 *
 * The §5 integration site uses this to group same-brand cards across
 * the chain and pick a single "winner" card per brand, enforcing
 * per-section dedup. The winner is then passed through the full gate
 * stack via {@link selectBrandHouseVoicingSentenceForComponent}; the
 * losers are silently skipped.
 *
 * Returns `null` when the component matches no entry, when the entry
 * is commercial or low-confidence, or when the role family is outside
 * the entry's `appliesToRoles`.
 *
 * Pure function. No state, no side effects.
 */
export function findEligibleBrandForComponent(
  componentName: string,
  roleFamily: RoleFamily | 'unknown',
): BrandHouseVoicing | null {
  const entry = findBrandHouseVoicing(componentName);
  if (!entry) return null;
  if (entry.priority === 'commercial') return null;
  if (entry.confidence === 'low') return null;
  if (!rolesInclude(entry.appliesToRoles, roleFamily)) return null;
  return entry;
}

// ─── Public selector ─────────────────────────────────────────────────

/**
 * §5 component-card brand-house-voicing selector.
 *
 * Runs the Stage E-5B.2 gate stack and either returns the chosen
 * brand-voicing sentence or `null` with a diagnostic suppression reason.
 *
 * Gate order (per user-supplied Stage E-5B.2 spec):
 *
 *   1. Feature-flag check (Gate #1) — NOT IN THIS HELPER. The caller
 *      is responsible for checking the flag before invoking. Keeping
 *      the flag check at the call site makes the helper trivially
 *      testable without env-var manipulation.
 *   2. Brand-lookup miss → `'no-match'`.
 *   3. `priority === 'commercial'` → `'commercial'`.
 *   4. `confidence === 'low'` → `'confidence-low'`.
 *   5. Role applicability — `appliesToRoles` excludes the component's
 *      `roleFamily` (and does not include `'all'`) → `'role-not-applicable'`.
 *   6. `hasConflictSignal === true` → `'conflict-signal'` (regardless
 *      of confidence; stricter than design doc).
 *   7. `isPrimaryConstraint === true` → `'primary-constraint'`.
 *   8. Sentence selection — iterate `houseVoicing` →
 *      `designPhilosophy` → `systemBuildingLogic`. For each non-empty
 *      field, run Gates #9 / #10 / #11. The first candidate that
 *      passes all three wins.
 *   9. Redundancy suppression against `existingCardProse` using the
 *      per-brand hint table.
 *  10. Anti-overclaim deny-check (per-entry + UNIVERSAL_AVOID_OVERCLAIMING).
 *  11. Architecture-produces-behavior shape check — candidate must
 *      contain at least one engineering anchor token.
 *
 * If no candidate field passes Gates #9 / #10 / #11, the result is
 * `null` with the suppression reason from the LAST field tried
 * (typically `'shape-check-failed'`).
 *
 * Returns at most ONE sentence. The §5 integration site is
 * responsible for the per-card cap; the helper is invoked once per
 * card.
 */
export function selectBrandHouseVoicingSentenceForComponent(
  input: BrandGateInputFor5,
): BrandGateResultFor5 {
  // Gate #2 — brand lookup
  const entry = findBrandHouseVoicing(input.componentName);
  if (!entry) return { sentence: null, suppressedBy: 'no-match' };

  // Gate #3 — commercial hard-gate
  if (entry.priority === 'commercial') {
    return { sentence: null, suppressedBy: 'commercial' };
  }

  // Gate #4 — confidence low
  if (entry.confidence === 'low') {
    return { sentence: null, suppressedBy: 'confidence-low' };
  }

  // Gate #5 — role applicability
  if (!rolesInclude(entry.appliesToRoles, input.roleFamily)) {
    return { sentence: null, suppressedBy: 'role-not-applicable' };
  }

  // Gate #6 — conflict-signal hard-gate (Stage E-5B.2 stricter rule)
  if (input.hasConflictSignal) {
    return { sentence: null, suppressedBy: 'conflict-signal' };
  }

  // Gate #7 — primary-constraint suppression
  if (input.isPrimaryConstraint) {
    return { sentence: null, suppressedBy: 'primary-constraint' };
  }

  // Gate #8 — sentence selection with post-selection-gate fall-through.
  //
  // Iterate the priority order. For each non-empty field, run gates
  // #9 / #10 / #11. The first candidate that passes all three wins.
  // If none passes, the suppression reason reflects the LAST candidate
  // tried (so callers can diagnose whether shape / redundancy / overclaim
  // was the recurring blocker).
  const candidates: Array<string | undefined> = [
    entry.houseVoicing,
    entry.designPhilosophy,
    entry.systemBuildingLogic,
  ];

  let lastReason: BrandGateResultFor5['suppressedBy'] = 'no-candidate-field';
  for (const candidate of candidates) {
    if (!candidate) continue;
    const evaluation = evaluateCandidate(
      candidate,
      entry,
      input.existingCardProse,
    );
    if (evaluation.ok) {
      return { sentence: evaluation.sentence };
    }
    lastReason = evaluation.reason;
  }
  return { sentence: null, suppressedBy: lastReason };
}

// ─── Re-exports for §5 integration ───────────────────────────────────

// Re-export so the §5 integration site has a single import surface
// for the gate stack + the data layer.
export {
  BRAND_HOUSE_VOICING,
  UNIVERSAL_AVOID_OVERCLAIMING,
  findBrandHouseVoicing,
  type BrandHouseVoicing,
  type RoleFamily,
};
