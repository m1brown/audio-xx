/**
 * Listener-identity + system-philosophy interpretive layer.
 *
 * Phase C Calibration Pass 1 (2026-05-14). Two closed-set deterministic
 * selectors that map existing `MemoFindings` + emergent-behavior tags
 * to two short pinned sentences appended to the SYSTEM READ block.
 *
 * Design goal:
 *   Move the assessment from "what the system sounds like" toward
 *   "what kind of listener and philosophy this system reflects",
 *   without becoming fluffy, generic, or generative.
 *
 * Architecture:
 *   - No prose synthesis. The selectors return a closed-set ID; the
 *     ID maps to a pinned sentence string. No adjective stacks grow.
 *   - Priority-ordered first-match. Each selector emits at most one
 *     ID.
 *   - Predicates read only existing fields on `MemoFindings` + the
 *     emergent-tag array from `getEmergentTags`. No new data is
 *     introduced and no engine code is touched.
 *   - Bottleneck-state is INTENTIONALLY not a skip gate — the engine
 *     sometimes flags a "bottleneck" with severity 0 on aligned
 *     coherent systems (e.g. modern-precision-control). The
 *     interpretive sentences describe the system's voicing
 *     philosophy regardless of constraint flags. Constraint
 *     handling stays in the Primary leverage / Decision sections.
 *
 * Negative-control requirement:
 *   `modern-precision-control` (Topping → Hegel → KEF) MUST produce
 *   a distinct identity+thesis pair from synergy systems. Verified by
 *   listener-archetype.test.ts and the reviewer-benchmark regression
 *   test extensions.
 */

import type { MemoFindings, ListenerPriority } from './memo-findings';
import type { EmergentBehavior } from './emergent-behavior';

// ── Closed-set IDs ─────────────────────────────────────────────────

export type ListenerArchetype =
  | 'harmonic-led'
  | 'timing-led'
  | 'flow-led'
  | 'composure-led'
  | 'transparency-led'
  | 'engagement-led'
  | 'coherence-led';

export type SystemPhilosophy =
  | 'measurement-first'
  | 'restraint-first'
  | 'immediacy-first'
  | 'music-first'
  | 'comfort-tuned';

// ── Sentence tables (pinned, never composed) ───────────────────────

const ARCHETYPE_SENTENCE: Record<ListenerArchetype, string> = {
  'harmonic-led':
    'This system reflects a listener who values harmonic density and tonal continuity over analytical detail.',
  'timing-led':
    'This system reflects a listener who values timing precision and dynamic immediacy over tonal saturation.',
  'flow-led':
    'This system reflects a listener who values musical flow and expressive ease over measured precision.',
  'composure-led':
    'This system reflects a listener who values composure, articulation, and control over saturation or bloom.',
  'transparency-led':
    'This system reflects a listener who values transparency, spatial precision, and low-level resolution.',
  'engagement-led':
    'This system reflects a listener who values long-session engagement and microdynamic expression.',
  'coherence-led':
    'This system reflects a listener committed to a single voicing philosophy over component-level optimisation.',
};

const PHILOSOPHY_SENTENCE: Record<SystemPhilosophy, string> = {
  'measurement-first':
    'This system prioritizes composure and precision over saturation.',
  'restraint-first':
    'This system values harmonic restraint and tonal continuity over forward presence.',
  'immediacy-first':
    'This system values immediacy and communication over polish.',
  'music-first':
    'This is a music-first system rather than a measurement-first system.',
  'comfort-tuned':
    'This is a comfort-tuned system.',
};

export function archetypeSentence(id: ListenerArchetype): string {
  return ARCHETYPE_SENTENCE[id];
}

export function philosophySentence(id: SystemPhilosophy): string {
  return PHILOSOPHY_SENTENCE[id];
}

// ── Selectors ──────────────────────────────────────────────────────

/**
 * Choose at most one ListenerArchetype based on existing findings +
 * emergent tags. Returns null when no rule fires.
 *
 * Priority order is intentional: harmonic / flow framings take
 * precedence over timing framing on warm-leaning systems, so a
 * coherent specialist pairing isn't mischaracterised as "speed-led"
 * just because the elastic axis happens to be present.
 */
export function selectListenerArchetype(
  findings: MemoFindings,
  emergentTags: ReadonlyArray<EmergentBehavior>,
): ListenerArchetype | null {
  if (findings.componentVerdicts.length < 2) return null;
  const axes = findings.systemAxes;
  const priorities: ReadonlyArray<ListenerPriority> = findings.listenerPriorities ?? [];
  const has = (t: ListenerPriority) => priorities.includes(t);
  const emergentHas = (t: EmergentBehavior) => emergentTags.includes(t);
  const isWarm = axes.warm_bright === 'warm';
  const intentionalSynergy = emergentTags.some((t) => INTENTIONAL_SYNERGY_FOR_ARCHETYPE.includes(t));

  // 1. harmonic-led — explicit harmonic_continuity OR warm chain that
  //    accumulates harmonic richness as a listener priority.
  if (emergentHas('harmonic_continuity')) return 'harmonic-led';
  if (isWarm && has('harmonic_richness')) return 'harmonic-led';

  // 2. timing-led — explicit timing+transient priorities OR strong
  //    emergent precision-elasticity signal. Excluded on warm systems
  //    so a warm coherent chain doesn't get a precision-flavour read.
  const timingPair = has('timing_accuracy') && has('transient_speed');
  const emergentTimingShape =
    emergentHas('dynamic_elasticity') && emergentHas('temporal_coherence');
  if (!isWarm && (timingPair || emergentTimingShape)) return 'timing-led';

  // 3. flow-led — explicit flow_continuity OR musical_flow priority
  //    when no control_precision counters it.
  if (emergentHas('flow_continuity')) return 'flow-led';
  if (has('musical_flow') && !has('control_precision')) return 'flow-led';

  // 4. composure-led — explicit control_precision + controlled axis.
  if (has('control_precision') && axes.elastic_controlled === 'controlled') {
    return 'composure-led';
  }

  // 5. transparency-led — transparency priority on a non-synergy
  //    detailed chain (avoid overwriting a synergy identity).
  if (
    has('transparency') &&
    axes.smooth_detailed === 'detailed' &&
    !intentionalSynergy
  ) {
    return 'transparency-led';
  }

  // 6. engagement-led — microdynamic + fatigue-resistance signal.
  if (has('microdynamic_expression') && has('fatigue_resistance')) {
    return 'engagement-led';
  }

  // 7. coherence-led — fallback for deliberately voiced systems that
  //    didn't hit any specific signal.
  if (findings.isCoherent && intentionalSynergy) return 'coherence-led';

  return null;
}

/**
 * Choose at most one SystemPhilosophy.
 *
 * The negative-control case (`modern-precision-control`) MUST produce
 * `measurement-first`, distinct from any synergy chain's thesis. The
 * order is priority-ordered to ensure that.
 */
export function selectSystemPhilosophy(
  findings: MemoFindings,
  emergentTags: ReadonlyArray<EmergentBehavior>,
): SystemPhilosophy | null {
  if (findings.componentVerdicts.length < 2) return null;
  const axes = findings.systemAxes;
  const emergentHas = (t: EmergentBehavior) => emergentTags.includes(t);
  const intentionalSynergy = emergentTags.some((t) => INTENTIONAL_SYNERGY_FOR_ARCHETYPE.includes(t));

  // 1. measurement-first — non-synergy chain with detailed + controlled
  //    axis stacking (Topping → Hegel → KEF pattern). Distinct from
  //    every synergy thesis below.
  if (
    !intentionalSynergy &&
    axes.smooth_detailed === 'detailed' &&
    axes.elastic_controlled === 'controlled'
  ) {
    return 'measurement-first';
  }

  // 2. restraint-first — explicit harmonic_continuity, or warm+smooth
  //    synergy systems (Leben/DeVore, R2R+SET+horn, BBC+push-pull).
  if (emergentHas('harmonic_continuity')) return 'restraint-first';
  if (
    intentionalSynergy &&
    axes.warm_bright === 'warm' &&
    axes.smooth_detailed === 'smooth'
  ) {
    return 'restraint-first';
  }

  // 3. immediacy-first — speed-forward synergy systems (my-system
  //    pattern: dynamic_elasticity AND (low_drag OR temporal_coherence)).
  if (
    emergentHas('dynamic_elasticity') &&
    (emergentHas('low_drag') || emergentHas('temporal_coherence'))
  ) {
    return 'immediacy-first';
  }

  // 4. music-first — generic synergy fallback. Any intentional synergy
  //    chain that didn't hit a more specific thesis above.
  if (intentionalSynergy) return 'music-first';

  // 5. comfort-tuned — non-synergy warm + smooth chain.
  if (
    !intentionalSynergy &&
    axes.warm_bright === 'warm' &&
    axes.smooth_detailed === 'smooth'
  ) {
    return 'comfort-tuned';
  }

  return null;
}

// ── Local mirror of intentional-synergy tag set ────────────────────
//
// Duplicated here (instead of importing from emergent-behavior.ts) to
// keep the module dependency-free and importable from anywhere. Kept
// short and in sync via a unit test that asserts the two arrays match.

const INTENTIONAL_SYNERGY_FOR_ARCHETYPE: ReadonlyArray<EmergentBehavior> = [
  'dynamic_elasticity',
  'low_drag',
  'temporal_coherence',
  'harmonic_continuity',
  'flow_continuity',
];

// Exported for tests.
export const __TEST__ = {
  INTENTIONAL_SYNERGY_FOR_ARCHETYPE,
  ARCHETYPE_SENTENCE,
  PHILOSOPHY_SENTENCE,
};
