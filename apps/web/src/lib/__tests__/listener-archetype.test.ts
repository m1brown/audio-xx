// @ts-nocheck — vitest globals injected via apps/web vitest config

/**
 * Phase C Calibration Pass 1 — listener archetype + system philosophy
 * selectors.
 *
 * Three tiers:
 *   1. Unit — synthetic MemoFindings + emergent tag inputs, verify the
 *      right closed-set ID fires for each rule + first-match priority.
 *   2. Integration — call buildSystemAssessment against the real catalog
 *      for the three Phase C target cases and assert the rendered
 *      SYSTEM READ contains the predicted identity + thesis sentences.
 *   3. Cross-case — assert the four target cases produce FOUR DISTINCT
 *      identity+thesis pairs (negative-control proof).
 */

import { describe, it, expect } from 'vitest';
import {
  selectListenerArchetype,
  selectSystemPhilosophy,
  archetypeSentence,
  philosophySentence,
  __TEST__,
  type ListenerArchetype,
  type SystemPhilosophy,
} from '../listener-archetype';
import { INTENTIONAL_SYNERGY_TAGS } from '../emergent-behavior';
import { detectIntent, extractSubjectMatches } from '../intent';
import { buildSystemAssessment } from '../consultation';
import type { MemoFindings, ComponentFindings, ListenerPriority } from '../memo-findings';
import type { EmergentBehavior } from '../emergent-behavior';

// ── Fixture helpers ────────────────────────────────────────────────

function makeComponent(opts: Partial<ComponentFindings> & { name: string; role: string }): ComponentFindings {
  return {
    name: opts.name,
    role: opts.role,
    roles: opts.roles ?? [opts.role],
    catalogSource: opts.catalogSource ?? 'product',
    axisPosition: opts.axisPosition ?? {
      warm_bright: 'neutral', smooth_detailed: 'neutral',
      elastic_controlled: 'neutral', airy_closed: 'neutral', scale_intimacy: 'neutral',
    },
    strengths: [], weaknesses: [], verdict: 'keep',
    confidence: opts.confidence ?? 'medium',
  } as ComponentFindings;
}

function makeFindings(opts: Partial<MemoFindings> & { componentVerdicts: ComponentFindings[] }): MemoFindings {
  return {
    componentNames: opts.componentVerdicts.map((c) => c.name),
    systemChain: { roles: [], names: [] },
    systemAxes: opts.systemAxes ?? {
      warm_bright: 'neutral', smooth_detailed: 'neutral',
      elastic_controlled: 'neutral', airy_closed: 'neutral', scale_intimacy: 'neutral',
    },
    perComponentAxes: [],
    stackedTraits: [],
    bottleneck: opts.bottleneck ?? null,
    componentVerdicts: opts.componentVerdicts,
    upgradePaths: [], keeps: [], recommendedSequence: [],
    isDeliberate: opts.isDeliberate ?? false,
    isCoherent: opts.isCoherent ?? false,
    coherentSharedTraits: [], coherentTradeoffs: [],
    deliberatenessSignals: [],
    listenerPriorities: opts.listenerPriorities ?? [],
    hasMultipleDACs: false, hasMultipleAmps: false, roleOverlaps: [],
    activeDACInference: { activeDACName: null, activeDACType: null, multipleDACs: false, needsDACClarification: false, confidence: 'high' },
    powerMatchAssessment: { ampName: null, speakerName: null, ampPowerWatts: null, speakerSensitivityDb: null, compatibility: 'unknown', estimatedMaxCleanSPL: null, relevantInteraction: null },
    sourceReferences: [],
  } as MemoFindings;
}

const THREE_COMPS = [
  makeComponent({ name: 'A', role: 'dac' }),
  makeComponent({ name: 'B', role: 'integrated' }),
  makeComponent({ name: 'C', role: 'speaker' }),
];

// ── Unit — listener archetype selector ─────────────────────────────

describe('selectListenerArchetype — closed-set priority cascade', () => {
  it('returns null for systems with < 2 components', () => {
    const findings = makeFindings({ componentVerdicts: [makeComponent({ name: 'lonely', role: 'dac' })] });
    expect(selectListenerArchetype(findings, [])).toBeNull();
  });

  it('harmonic-led fires on explicit harmonic_continuity tag', () => {
    const findings = makeFindings({ componentVerdicts: THREE_COMPS });
    expect(selectListenerArchetype(findings, ['harmonic_continuity'])).toBe('harmonic-led');
  });

  it('harmonic-led fires on warm chain + harmonic_richness priority (Leben/DeVore pattern)', () => {
    const findings = makeFindings({
      componentVerdicts: THREE_COMPS,
      systemAxes: { warm_bright: 'warm', smooth_detailed: 'smooth', elastic_controlled: 'elastic', airy_closed: 'airy', scale_intimacy: 'neutral' },
      listenerPriorities: ['harmonic_richness', 'tonal_warmth'] as ListenerPriority[],
    });
    expect(selectListenerArchetype(findings, ['dynamic_elasticity', 'low_drag'])).toBe('harmonic-led');
  });

  it('timing-led fires on timing_accuracy + transient_speed (my-system pattern, non-warm)', () => {
    const findings = makeFindings({
      componentVerdicts: THREE_COMPS,
      systemAxes: { warm_bright: 'bright', smooth_detailed: 'detailed', elastic_controlled: 'elastic', airy_closed: 'airy', scale_intimacy: 'neutral' },
      listenerPriorities: ['timing_accuracy', 'transient_speed', 'low_stored_energy'] as ListenerPriority[],
    });
    expect(selectListenerArchetype(findings, ['dynamic_elasticity', 'low_drag'])).toBe('timing-led');
  });

  it('timing-led does NOT fire on warm systems (warm gets harmonic/flow instead)', () => {
    const findings = makeFindings({
      componentVerdicts: THREE_COMPS,
      systemAxes: { warm_bright: 'warm', smooth_detailed: 'smooth', elastic_controlled: 'elastic', airy_closed: 'airy', scale_intimacy: 'neutral' },
      listenerPriorities: ['timing_accuracy', 'transient_speed'] as ListenerPriority[],
    });
    expect(selectListenerArchetype(findings, [])).not.toBe('timing-led');
  });

  it('composure-led fires for control_precision + controlled axis (precision-control pattern)', () => {
    const findings = makeFindings({
      componentVerdicts: THREE_COMPS,
      systemAxes: { warm_bright: 'bright', smooth_detailed: 'detailed', elastic_controlled: 'controlled', airy_closed: 'neutral', scale_intimacy: 'neutral' },
      listenerPriorities: ['control_precision', 'transparency', 'transient_speed'] as ListenerPriority[],
    });
    expect(selectListenerArchetype(findings, [])).toBe('composure-led');
  });

  it('flow-led fires on flow_continuity emergent tag', () => {
    const findings = makeFindings({ componentVerdicts: THREE_COMPS });
    expect(selectListenerArchetype(findings, ['flow_continuity'])).toBe('flow-led');
  });

  it('transparency-led fires on transparency + detailed + no synergy', () => {
    const findings = makeFindings({
      componentVerdicts: THREE_COMPS,
      systemAxes: { warm_bright: 'neutral', smooth_detailed: 'detailed', elastic_controlled: 'neutral', airy_closed: 'neutral', scale_intimacy: 'neutral' },
      listenerPriorities: ['transparency'] as ListenerPriority[],
    });
    expect(selectListenerArchetype(findings, [])).toBe('transparency-led');
  });

  it('transparency-led does NOT fire when intentional synergy is present (synergy takes precedence)', () => {
    const findings = makeFindings({
      componentVerdicts: THREE_COMPS,
      systemAxes: { warm_bright: 'neutral', smooth_detailed: 'detailed', elastic_controlled: 'neutral', airy_closed: 'neutral', scale_intimacy: 'neutral' },
      listenerPriorities: ['transparency'] as ListenerPriority[],
    });
    // dynamic_elasticity present → counts as intentional synergy → blocks transparency
    const result = selectListenerArchetype(findings, ['dynamic_elasticity']);
    expect(result).not.toBe('transparency-led');
  });

  it('engagement-led fires on microdynamic + fatigue-resistance priorities', () => {
    const findings = makeFindings({
      componentVerdicts: THREE_COMPS,
      listenerPriorities: ['microdynamic_expression', 'fatigue_resistance'] as ListenerPriority[],
    });
    expect(selectListenerArchetype(findings, [])).toBe('engagement-led');
  });

  it('coherence-led is the fallback for coherent synergy systems with no specific signal', () => {
    const findings = makeFindings({
      componentVerdicts: THREE_COMPS,
      isCoherent: true,
      listenerPriorities: [] as ListenerPriority[],
    });
    expect(selectListenerArchetype(findings, ['dynamic_elasticity'])).toBe('coherence-led');
  });

  it('returns null when nothing fires', () => {
    const findings = makeFindings({ componentVerdicts: THREE_COMPS });
    expect(selectListenerArchetype(findings, [])).toBeNull();
  });
});

// ── Unit — system philosophy selector ──────────────────────────────

describe('selectSystemPhilosophy — closed-set priority cascade', () => {
  it('measurement-first fires for non-synergy detailed + controlled chain', () => {
    const findings = makeFindings({
      componentVerdicts: THREE_COMPS,
      systemAxes: { warm_bright: 'bright', smooth_detailed: 'detailed', elastic_controlled: 'controlled', airy_closed: 'neutral', scale_intimacy: 'neutral' },
    });
    expect(selectSystemPhilosophy(findings, [])).toBe('measurement-first');
  });

  it('restraint-first fires on harmonic_continuity', () => {
    const findings = makeFindings({ componentVerdicts: THREE_COMPS });
    expect(selectSystemPhilosophy(findings, ['harmonic_continuity'])).toBe('restraint-first');
  });

  it('restraint-first fires on intentional synergy + warm + smooth (Leben/DeVore pattern)', () => {
    const findings = makeFindings({
      componentVerdicts: THREE_COMPS,
      systemAxes: { warm_bright: 'warm', smooth_detailed: 'smooth', elastic_controlled: 'elastic', airy_closed: 'airy', scale_intimacy: 'neutral' },
    });
    expect(selectSystemPhilosophy(findings, ['dynamic_elasticity', 'low_drag'])).toBe('restraint-first');
  });

  it('immediacy-first fires on dynamic_elasticity + low_drag (my-system pattern)', () => {
    const findings = makeFindings({
      componentVerdicts: THREE_COMPS,
      systemAxes: { warm_bright: 'bright', smooth_detailed: 'detailed', elastic_controlled: 'elastic', airy_closed: 'airy', scale_intimacy: 'neutral' },
    });
    expect(selectSystemPhilosophy(findings, ['dynamic_elasticity', 'low_drag'])).toBe('immediacy-first');
  });

  it('music-first is the generic synergy fallback', () => {
    const findings = makeFindings({ componentVerdicts: THREE_COMPS });
    expect(selectSystemPhilosophy(findings, ['flow_continuity'])).toBe('music-first');
  });

  it('comfort-tuned fires for non-synergy warm + smooth chain', () => {
    const findings = makeFindings({
      componentVerdicts: THREE_COMPS,
      systemAxes: { warm_bright: 'warm', smooth_detailed: 'smooth', elastic_controlled: 'neutral', airy_closed: 'neutral', scale_intimacy: 'neutral' },
    });
    expect(selectSystemPhilosophy(findings, [])).toBe('comfort-tuned');
  });

  it('returns null when nothing fires', () => {
    const findings = makeFindings({ componentVerdicts: THREE_COMPS });
    expect(selectSystemPhilosophy(findings, [])).toBeNull();
  });
});

// ── Sentence tables ────────────────────────────────────────────────

describe('sentence tables — pinned closed-set strings', () => {
  it('every ListenerArchetype id maps to a non-empty sentence', () => {
    const ids: ListenerArchetype[] = [
      'harmonic-led', 'timing-led', 'flow-led', 'composure-led',
      'transparency-led', 'engagement-led', 'coherence-led',
    ];
    for (const id of ids) {
      const s = archetypeSentence(id);
      expect(s.length).toBeGreaterThan(20);
      expect(s).toMatch(/^This system reflects a listener/i);
    }
  });

  it('every SystemPhilosophy id maps to a non-empty sentence', () => {
    const ids: SystemPhilosophy[] = [
      'measurement-first', 'restraint-first', 'immediacy-first', 'music-first', 'comfort-tuned',
    ];
    for (const id of ids) {
      const s = philosophySentence(id);
      expect(s.length).toBeGreaterThan(15);
      expect(s).toMatch(/^This (?:system|is)/i);
    }
  });

  it('local INTENTIONAL_SYNERGY_FOR_ARCHETYPE is in sync with emergent-behavior\'s export', () => {
    const local = __TEST__.INTENTIONAL_SYNERGY_FOR_ARCHETYPE.slice().sort();
    const upstream = (INTENTIONAL_SYNERGY_TAGS as ReadonlyArray<EmergentBehavior>).slice().sort();
    expect(local).toEqual(upstream);
  });
});

// ── Integration — end-to-end against the real catalog ─────────────

describe('integration — buildSystemAssessment renders the predicted sentences', () => {
  function run(text: string): string {
    const subjects = extractSubjectMatches(text);
    const { desires } = detectIntent(text);
    const result = buildSystemAssessment(text, subjects, null, desires);
    if (result?.kind !== 'assessment') return '';
    return result.response?.systemContext ?? '';
  }

  it('my-system → timing-led identity + immediacy-first thesis', () => {
    const narrative = run('Assess my system: Eversolo DMP-A6, Chord Hugo, JOB Integrated, WLM Diva Monitor');
    expect(narrative).toContain('This system reflects a listener who values timing precision and dynamic immediacy over tonal saturation.');
    expect(narrative).toContain('This system values immediacy and communication over polish.');
  });

  it('leben-devore → harmonic-led identity + restraint-first thesis', () => {
    const narrative = run('Assess my system: Denafrips Pontus II, Leben CS600X, DeVore O/96');
    expect(narrative).toContain('This system reflects a listener who values harmonic density and tonal continuity over analytical detail.');
    expect(narrative).toContain('This system values harmonic restraint and tonal continuity over forward presence.');
  });

  it('modern-precision-control → composure-led identity + measurement-first thesis (negative control)', () => {
    const narrative = run('Assess my system: Topping D90SE, Hegel H190, KEF LS50 Meta');
    expect(narrative).toContain('This system reflects a listener who values composure, articulation, and control over saturation or bloom.');
    expect(narrative).toContain('This system prioritizes composure and precision over saturation.');
  });
});

// ── Cross-case — distinctness guarantee ──────────────────────────

describe('cross-case distinctness — negative-control proof', () => {
  function pair(text: string): { identity: string; thesis: string } {
    const subjects = extractSubjectMatches(text);
    const { desires } = detectIntent(text);
    const result = buildSystemAssessment(text, subjects, null, desires);
    if (result?.kind !== 'assessment') return { identity: '', thesis: '' };
    const narrative = result.response?.systemContext ?? '';
    const identityMatch = narrative.match(/This system reflects a listener[^.]+\./);
    const thesisMatch = narrative.match(/This (?:system|is) (?:values|prioritizes|is) [^.]+\.|This is a .+? system[^.]*\./);
    return {
      identity: identityMatch?.[0] ?? '',
      thesis: thesisMatch?.[0] ?? '',
    };
  }

  it('my-system and leben-devore have DIFFERENT identity sentences', () => {
    const a = pair('Assess my system: Eversolo DMP-A6, Chord Hugo, JOB Integrated, WLM Diva Monitor');
    const b = pair('Assess my system: Denafrips Pontus II, Leben CS600X, DeVore O/96');
    expect(a.identity).toBeTruthy();
    expect(b.identity).toBeTruthy();
    expect(a.identity).not.toBe(b.identity);
  });

  it('my-system and modern-precision-control have DIFFERENT identity sentences', () => {
    const a = pair('Assess my system: Eversolo DMP-A6, Chord Hugo, JOB Integrated, WLM Diva Monitor');
    const b = pair('Assess my system: Topping D90SE, Hegel H190, KEF LS50 Meta');
    expect(a.identity).not.toBe(b.identity);
  });

  it('leben-devore and modern-precision-control have DIFFERENT identity sentences', () => {
    const a = pair('Assess my system: Denafrips Pontus II, Leben CS600X, DeVore O/96');
    const b = pair('Assess my system: Topping D90SE, Hegel H190, KEF LS50 Meta');
    expect(a.identity).not.toBe(b.identity);
  });

  it('modern-precision-control identity contains "composure" — negative control distinct from synergy systems', () => {
    const b = pair('Assess my system: Topping D90SE, Hegel H190, KEF LS50 Meta');
    expect(b.identity).toMatch(/composure/i);
    expect(b.identity).not.toMatch(/harmonic density|timing precision|musical flow/i);
  });
});
