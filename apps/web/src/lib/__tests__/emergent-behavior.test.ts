// @ts-nocheck — vitest globals injected via apps/web vitest config

/**
 * Phase 2.5 — Emergent System Reasoning.
 *
 * Tests the deterministic emergent-behavior layer that adds an
 * interaction paragraph to system assessments. The layer reads only
 * existing MemoFindings fields and returns '' when skip conditions
 * hold or no transform fires.
 *
 * Coverage:
 *   - 8 transforms × pass + fail case (16 tests)
 *   - 4 skip-condition cases
 *   - 3 selection / distinctness rules
 *   - My System calibration (the canonical case)
 *   - 1 tension negative-case (Topping → Hegel → Harbeth)
 */

import {
  composeEmergentBehavior,
  selectEmergentTags,
  __TEST__,
  type EmergentBehavior,
} from '../emergent-behavior';
import type { MemoFindings, ComponentFindings } from '../memo-findings';

const { TRANSFORMS, shouldSkip, isDistinct } = __TEST__;

// ── Fixture helpers ────────────────────────────────────────────────

function makeComponent(opts: Partial<ComponentFindings> & { name: string; role: string }): ComponentFindings {
  return {
    name: opts.name,
    role: opts.role,
    roles: opts.roles ?? [opts.role],
    catalogSource: opts.catalogSource ?? 'product',
    axisPosition: opts.axisPosition ?? {
      warm_bright: 'neutral',
      smooth_detailed: 'neutral',
      elastic_controlled: 'neutral',
      airy_closed: 'neutral',
      scale_intimacy: 'neutral',
    },
    strengths: opts.strengths ?? [],
    weaknesses: opts.weaknesses ?? [],
    verdict: opts.verdict ?? 'keep',
    architecture: opts.architecture,
    priceTier: opts.priceTier,
    price: opts.price,
    confidence: opts.confidence ?? 'medium',
  } as ComponentFindings;
}

function makeFindings(opts: Partial<MemoFindings> & { componentVerdicts: ComponentFindings[] }): MemoFindings {
  const verdicts = opts.componentVerdicts;
  const dacName = verdicts.find((c) => c.role === 'dac')?.name ?? null;
  return {
    componentNames: verdicts.map((c) => c.name),
    systemChain: { roles: verdicts.map((c) => c.role), names: verdicts.map((c) => c.name) },
    systemAxes: opts.systemAxes ?? {
      warm_bright: 'neutral',
      smooth_detailed: 'neutral',
      elastic_controlled: 'neutral',
      airy_closed: 'neutral',
      scale_intimacy: 'neutral',
    },
    perComponentAxes: verdicts.map((c) => ({ name: c.name, axes: c.axisPosition, source: c.catalogSource })),
    stackedTraits: opts.stackedTraits ?? [],
    bottleneck: opts.bottleneck ?? null,
    componentVerdicts: verdicts,
    upgradePaths: opts.upgradePaths ?? [],
    keeps: opts.keeps ?? [],
    recommendedSequence: opts.recommendedSequence ?? [],
    isDeliberate: opts.isDeliberate ?? false,
    isCoherent: opts.isCoherent ?? false,
    coherentSharedTraits: opts.coherentSharedTraits ?? [],
    coherentTradeoffs: opts.coherentTradeoffs ?? [],
    deliberatenessSignals: opts.deliberatenessSignals ?? [],
    listenerPriorities: opts.listenerPriorities ?? [],
    hasMultipleDACs: opts.hasMultipleDACs ?? false,
    hasMultipleAmps: opts.hasMultipleAmps ?? false,
    roleOverlaps: opts.roleOverlaps ?? [],
    activeDACInference: opts.activeDACInference ?? {
      activeDACName: dacName,
      activeDACType: dacName ? 'standalone' : null,
      multipleDACs: false,
      needsDACClarification: false,
      confidence: 'high',
    },
    powerMatchAssessment: opts.powerMatchAssessment ?? {
      ampName: null,
      speakerName: null,
      ampPowerWatts: null,
      speakerSensitivityDb: null,
      compatibility: 'unknown',
      estimatedMaxCleanSPL: null,
      relevantInteraction: null,
    },
    sourceReferences: opts.sourceReferences ?? [],
  } as MemoFindings;
}

// ── 1. Transform: temporal_coherence ───────────────────────────────

describe('transform temporal_coherence', () => {
  it('fires for 2+ detailed components with no controlled link', () => {
    const findings = makeFindings({
      componentVerdicts: [
        makeComponent({ name: 'DAC X', role: 'dac', axisPosition: { warm_bright: 'bright', smooth_detailed: 'detailed', elastic_controlled: 'elastic', airy_closed: 'neutral', scale_intimacy: 'neutral' } }),
        makeComponent({ name: 'Amp Y', role: 'integrated', axisPosition: { warm_bright: 'neutral', smooth_detailed: 'detailed', elastic_controlled: 'elastic', airy_closed: 'neutral', scale_intimacy: 'neutral' } }),
        makeComponent({ name: 'Speaker Z', role: 'speaker', axisPosition: { warm_bright: 'warm', smooth_detailed: 'neutral', elastic_controlled: 'elastic', airy_closed: 'neutral', scale_intimacy: 'neutral' } }),
      ],
    });
    const tag = TRANSFORMS.map((t) => t(findings)).find((r) => r && r.tag === 'temporal_coherence');
    expect(tag).toBeTruthy();
  });

  it('does NOT fire when one component is controlled (slow link)', () => {
    const findings = makeFindings({
      componentVerdicts: [
        makeComponent({ name: 'DAC X', role: 'dac', axisPosition: { warm_bright: 'bright', smooth_detailed: 'detailed', elastic_controlled: 'elastic', airy_closed: 'neutral', scale_intimacy: 'neutral' } }),
        makeComponent({ name: 'Amp Y', role: 'integrated', axisPosition: { warm_bright: 'neutral', smooth_detailed: 'detailed', elastic_controlled: 'controlled', airy_closed: 'neutral', scale_intimacy: 'neutral' } }),
        makeComponent({ name: 'Speaker Z', role: 'speaker', axisPosition: { warm_bright: 'warm', smooth_detailed: 'neutral', elastic_controlled: 'elastic', airy_closed: 'neutral', scale_intimacy: 'neutral' } }),
      ],
    });
    const tag = TRANSFORMS.map((t) => t(findings)).find((r) => r && r.tag === 'temporal_coherence');
    expect(tag).toBeUndefined();
  });
});

// ── 2. Transform: dynamic_elasticity ───────────────────────────────

describe('transform dynamic_elasticity', () => {
  it('fires for low-feedback amp + high-efficiency speaker', () => {
    const findings = makeFindings({
      componentVerdicts: [
        makeComponent({ name: 'DAC X', role: 'dac' }),
        makeComponent({ name: 'JOB Integrated', role: 'integrated', architecture: 'low-feedback class A solid-state' }),
        makeComponent({ name: 'WLM Diva Monitor', role: 'speaker', architecture: 'high-efficiency paper-cone monitor' }),
      ],
    });
    const tag = TRANSFORMS.map((t) => t(findings)).find((r) => r && r.tag === 'dynamic_elasticity');
    expect(tag).toBeTruthy();
    expect(tag!.contributors).toContain('JOB Integrated');
  });

  it('does NOT fire with class-AB amp (no low-feedback signal)', () => {
    const findings = makeFindings({
      componentVerdicts: [
        makeComponent({ name: 'DAC X', role: 'dac' }),
        makeComponent({ name: 'Class AB Amp', role: 'integrated', architecture: 'class AB high-feedback', axisPosition: { warm_bright: 'bright', smooth_detailed: 'detailed', elastic_controlled: 'controlled', airy_closed: 'neutral', scale_intimacy: 'neutral' } }),
        makeComponent({ name: 'WLM Diva Monitor', role: 'speaker', architecture: 'high-efficiency paper-cone monitor' }),
      ],
    });
    const tag = TRANSFORMS.map((t) => t(findings)).find((r) => r && r.tag === 'dynamic_elasticity');
    expect(tag).toBeUndefined();
  });
});

// ── 3. Transform: low_drag ─────────────────────────────────────────

describe('transform low_drag', () => {
  it('fires for low-feedback amp + high-efficiency speaker', () => {
    const findings = makeFindings({
      componentVerdicts: [
        makeComponent({ name: 'Hugo', role: 'dac', architecture: 'FPGA pulse-array' }),
        makeComponent({ name: 'JOB', role: 'integrated', architecture: 'low-feedback class A' }),
        makeComponent({ name: 'WLM Diva', role: 'speaker', architecture: 'high-efficiency paper-cone' }),
      ],
    });
    const tag = TRANSFORMS.map((t) => t(findings)).find((r) => r && r.tag === 'low_drag');
    expect(tag).toBeTruthy();
  });

  it('does NOT fire without a high-efficiency speaker', () => {
    const findings = makeFindings({
      componentVerdicts: [
        makeComponent({ name: 'Hugo', role: 'dac', architecture: 'FPGA pulse-array' }),
        makeComponent({ name: 'JOB', role: 'integrated', architecture: 'low-feedback class A' }),
        makeComponent({ name: 'Generic Speaker', role: 'speaker' }),
      ],
    });
    const tag = TRANSFORMS.map((t) => t(findings)).find((r) => r && r.tag === 'low_drag');
    expect(tag).toBeUndefined();
  });
});

// ── 4. Transform: harmonic_continuity (FPGA EXCLUDED per user) ────

describe('transform harmonic_continuity', () => {
  it('fires for R2R DAC + paper-cone speaker', () => {
    const findings = makeFindings({
      componentVerdicts: [
        makeComponent({ name: 'R2R DAC', role: 'dac', architecture: 'discrete R2R ladder DAC' }),
        makeComponent({ name: 'Amp', role: 'integrated' }),
        makeComponent({ name: 'Speaker', role: 'speaker', architecture: 'paper-cone high-efficiency' }),
      ],
    });
    const tag = TRANSFORMS.map((t) => t(findings)).find((r) => r && r.tag === 'harmonic_continuity');
    expect(tag).toBeTruthy();
  });

  it('fires for tube amp + BBC thin-wall speaker', () => {
    const findings = makeFindings({
      componentVerdicts: [
        makeComponent({ name: 'DAC', role: 'dac' }),
        makeComponent({ name: 'Leben CS600X', role: 'integrated', architecture: 'push-pull tube' }),
        makeComponent({ name: 'Harbeth', role: 'speaker', architecture: 'BBC thin-wall monitor' }),
      ],
    });
    const tag = TRANSFORMS.map((t) => t(findings)).find((r) => r && r.tag === 'harmonic_continuity');
    expect(tag).toBeTruthy();
  });

  it('does NOT fire for FPGA DAC + paper-cone speaker (per Phase 2.5 calibration)', () => {
    // FPGA pulse-array supports timing precision and liveliness, but
    // harmonic_continuity stays reserved for R2R/NOS/tube/paper/BBC/
    // full-range matching. Hugo/Diva should surface via low_drag /
    // dynamic_elasticity / temporal_coherence, not harmonic_continuity.
    const findings = makeFindings({
      componentVerdicts: [
        makeComponent({ name: 'Hugo', role: 'dac', architecture: 'FPGA pulse-array' }),
        makeComponent({ name: 'Amp', role: 'integrated' }),
        makeComponent({ name: 'Speaker', role: 'speaker', architecture: 'paper-cone high-efficiency' }),
      ],
    });
    const tag = TRANSFORMS.map((t) => t(findings)).find((r) => r && r.tag === 'harmonic_continuity');
    expect(tag).toBeUndefined();
  });
});

// ── 5. Transform: compression_resilience ───────────────────────────

describe('transform compression_resilience', () => {
  it('fires for optimal power match with estimated max clean SPL >= 105 dB', () => {
    const findings = makeFindings({
      componentVerdicts: [
        makeComponent({ name: 'DAC', role: 'dac' }),
        makeComponent({ name: 'Amp', role: 'integrated' }),
        makeComponent({ name: 'Speaker', role: 'speaker' }),
      ],
      powerMatchAssessment: {
        ampName: 'Amp', speakerName: 'Speaker',
        ampPowerWatts: 25, speakerSensitivityDb: 96,
        compatibility: 'optimal',
        estimatedMaxCleanSPL: 110,
        relevantInteraction: null,
      },
    });
    const tag = TRANSFORMS.map((t) => t(findings)).find((r) => r && r.tag === 'compression_resilience');
    expect(tag).toBeTruthy();
  });

  it('does NOT fire for adequate or strained power match', () => {
    const findings = makeFindings({
      componentVerdicts: [
        makeComponent({ name: 'DAC', role: 'dac' }),
        makeComponent({ name: 'Amp', role: 'integrated' }),
        makeComponent({ name: 'Speaker', role: 'speaker' }),
      ],
      powerMatchAssessment: {
        ampName: 'Amp', speakerName: 'Speaker',
        ampPowerWatts: 10, speakerSensitivityDb: 84,
        compatibility: 'strained',
        estimatedMaxCleanSPL: 94,
        relevantInteraction: null,
      },
    });
    // shouldSkip catches strained anyway; but transform itself must return null
    const tag = TRANSFORMS.map((t) => t(findings)).find((r) => r && r.tag === 'compression_resilience');
    expect(tag).toBeUndefined();
  });
});

// ── 6. Transform: presence_lift ────────────────────────────────────

describe('transform presence_lift', () => {
  it('fires for bright/detailed upstream + high-efficiency speaker', () => {
    const findings = makeFindings({
      componentVerdicts: [
        makeComponent({ name: 'Hugo', role: 'dac', axisPosition: { warm_bright: 'bright', smooth_detailed: 'detailed', elastic_controlled: 'elastic', airy_closed: 'neutral', scale_intimacy: 'neutral' } }),
        makeComponent({ name: 'Amp', role: 'integrated' }),
        makeComponent({ name: 'WLM Diva', role: 'speaker', architecture: 'high-efficiency paper-cone' }),
      ],
    });
    const tag = TRANSFORMS.map((t) => t(findings)).find((r) => r && r.tag === 'presence_lift');
    expect(tag).toBeTruthy();
  });
});

// ── 7. Transform: system_tension_active ────────────────────────────

describe('transform system_tension_active', () => {
  it('fires for non-coherent system with sharp upstream/downstream contrast', () => {
    const findings = makeFindings({
      isCoherent: false,
      componentVerdicts: [
        makeComponent({ name: 'Topping D90', role: 'dac', axisPosition: { warm_bright: 'bright', smooth_detailed: 'detailed', elastic_controlled: 'controlled', airy_closed: 'neutral', scale_intimacy: 'neutral' } }),
        makeComponent({ name: 'Hegel H190', role: 'integrated', axisPosition: { warm_bright: 'bright', smooth_detailed: 'detailed', elastic_controlled: 'controlled', airy_closed: 'neutral', scale_intimacy: 'neutral' } }),
        makeComponent({ name: 'Harbeth Compact 7', role: 'speaker', architecture: 'BBC thin-wall', axisPosition: { warm_bright: 'warm', smooth_detailed: 'smooth', elastic_controlled: 'neutral', airy_closed: 'neutral', scale_intimacy: 'neutral' } }),
      ],
    });
    const tag = TRANSFORMS.map((t) => t(findings)).find((r) => r && r.tag === 'system_tension_active');
    expect(tag).toBeTruthy();
  });

  it('does NOT fire when system is coherent (specialist pairing)', () => {
    const findings = makeFindings({
      isCoherent: true,
      componentVerdicts: [
        makeComponent({ name: 'Hugo', role: 'dac', axisPosition: { warm_bright: 'bright', smooth_detailed: 'detailed', elastic_controlled: 'elastic', airy_closed: 'neutral', scale_intimacy: 'neutral' } }),
        makeComponent({ name: 'JOB', role: 'integrated', axisPosition: { warm_bright: 'bright', smooth_detailed: 'detailed', elastic_controlled: 'elastic', airy_closed: 'neutral', scale_intimacy: 'neutral' } }),
        makeComponent({ name: 'WLM Diva', role: 'speaker', architecture: 'high-efficiency paper-cone', axisPosition: { warm_bright: 'warm', smooth_detailed: 'smooth', elastic_controlled: 'elastic', airy_closed: 'neutral', scale_intimacy: 'neutral' } }),
      ],
    });
    const tag = TRANSFORMS.map((t) => t(findings)).find((r) => r && r.tag === 'system_tension_active');
    expect(tag).toBeUndefined();
  });
});

// ── 8. Transform: flow_continuity ──────────────────────────────────

describe('transform flow_continuity', () => {
  it('fires when 3+ components are elastic', () => {
    const findings = makeFindings({
      componentVerdicts: [
        makeComponent({ name: 'A', role: 'dac', axisPosition: { warm_bright: 'neutral', smooth_detailed: 'neutral', elastic_controlled: 'elastic', airy_closed: 'neutral', scale_intimacy: 'neutral' } }),
        makeComponent({ name: 'B', role: 'integrated', axisPosition: { warm_bright: 'neutral', smooth_detailed: 'neutral', elastic_controlled: 'elastic', airy_closed: 'neutral', scale_intimacy: 'neutral' } }),
        makeComponent({ name: 'C', role: 'speaker', axisPosition: { warm_bright: 'neutral', smooth_detailed: 'neutral', elastic_controlled: 'elastic', airy_closed: 'neutral', scale_intimacy: 'neutral' } }),
      ],
    });
    const tag = TRANSFORMS.map((t) => t(findings)).find((r) => r && r.tag === 'flow_continuity');
    expect(tag).toBeTruthy();
  });
});

// ── Skip conditions ────────────────────────────────────────────────

describe('skip conditions — composeEmergentBehavior returns empty string', () => {
  it('skips when fewer than 3 components', () => {
    const findings = makeFindings({
      componentVerdicts: [
        makeComponent({ name: 'A', role: 'dac' }),
        makeComponent({ name: 'B', role: 'speaker' }),
      ],
    });
    expect(composeEmergentBehavior(findings)).toBe('');
  });

  it('skips when bottleneck is present', () => {
    const findings = makeFindings({
      componentVerdicts: [
        makeComponent({ name: 'A', role: 'dac' }),
        makeComponent({ name: 'B', role: 'integrated' }),
        makeComponent({ name: 'C', role: 'speaker' }),
      ],
      bottleneck: { component: 'A', role: 'dac', category: 'dac_limitation', constrainedAxes: ['smooth_detailed'], severity: 0.8 },
    });
    expect(composeEmergentBehavior(findings)).toBe('');
  });

  it('skips on power mismatch (strained/mismatched)', () => {
    const findings = makeFindings({
      componentVerdicts: [
        makeComponent({ name: 'A', role: 'dac' }),
        makeComponent({ name: 'B', role: 'integrated' }),
        makeComponent({ name: 'C', role: 'speaker' }),
      ],
      powerMatchAssessment: {
        ampName: 'B', speakerName: 'C', ampPowerWatts: 5, speakerSensitivityDb: 84,
        compatibility: 'strained', estimatedMaxCleanSPL: 91, relevantInteraction: null,
      },
    });
    expect(composeEmergentBehavior(findings)).toBe('');
  });

  it('skips when fewer than 2 components reach medium+ confidence', () => {
    const findings = makeFindings({
      componentVerdicts: [
        makeComponent({ name: 'A', role: 'dac', confidence: 'low' }),
        makeComponent({ name: 'B', role: 'integrated', confidence: 'low' }),
        makeComponent({ name: 'C', role: 'speaker', confidence: 'medium' }),
      ],
    });
    expect(composeEmergentBehavior(findings)).toBe('');
  });
});

// ── Selection / distinctness rules ─────────────────────────────────

describe('selection and distinctness — second tag must add a distinct concept', () => {
  it('dynamic_elasticity + low_drag → both surface (distinct families)', () => {
    const sel = selectEmergentTags([
      { tag: 'dynamic_elasticity', confidence: 'high', contributors: [] },
      { tag: 'low_drag', confidence: 'medium', contributors: [] },
    ]);
    expect(sel.map((s) => s.tag)).toEqual(['dynamic_elasticity', 'low_drag']);
  });

  it('low_drag + flow_continuity → only low_drag (motion family)', () => {
    const sel = selectEmergentTags([
      { tag: 'low_drag', confidence: 'medium', contributors: [] },
      { tag: 'flow_continuity', confidence: 'medium', contributors: [] },
    ]);
    expect(sel.map((s) => s.tag)).toEqual(['low_drag']);
  });

  it('temporal_coherence + flow_continuity → only temporal_coherence (coherence family)', () => {
    const sel = selectEmergentTags([
      { tag: 'temporal_coherence', confidence: 'medium', contributors: [] },
      { tag: 'flow_continuity', confidence: 'medium', contributors: [] },
    ]);
    expect(sel.map((s) => s.tag)).toEqual(['temporal_coherence']);
  });

  it('isDistinct identifies redundant pairs', () => {
    expect(isDistinct('low_drag', 'flow_continuity')).toBe(false);
    expect(isDistinct('temporal_coherence', 'flow_continuity')).toBe(false);
    expect(isDistinct('dynamic_elasticity', 'low_drag')).toBe(true);
    expect(isDistinct('temporal_coherence', 'dynamic_elasticity')).toBe(true);
    expect(isDistinct('harmonic_continuity', 'low_drag')).toBe(true);
  });
});

// ── My System calibration ─────────────────────────────────────────

describe('My System calibration — Eversolo → Hugo → JOB → WLM Diva', () => {
  function makeMySystemFindings(): MemoFindings {
    return makeFindings({
      isCoherent: true,
      componentVerdicts: [
        makeComponent({
          name: 'Eversolo DMP-A6',
          role: 'streamer',
          architecture: 'streamer / source',
          confidence: 'medium',
          axisPosition: { warm_bright: 'neutral', smooth_detailed: 'neutral', elastic_controlled: 'neutral', airy_closed: 'neutral', scale_intimacy: 'neutral' },
        }),
        makeComponent({
          name: 'Chord Hugo',
          role: 'dac',
          architecture: 'FPGA pulse-array DAC',
          confidence: 'high',
          axisPosition: { warm_bright: 'bright', smooth_detailed: 'detailed', elastic_controlled: 'elastic', airy_closed: 'airy', scale_intimacy: 'neutral' },
        }),
        makeComponent({
          name: 'JOB Integrated',
          role: 'integrated',
          architecture: 'low-feedback class A solid-state (Goldmund-derived)',
          confidence: 'high',
          axisPosition: { warm_bright: 'neutral', smooth_detailed: 'detailed', elastic_controlled: 'elastic', airy_closed: 'airy', scale_intimacy: 'neutral' },
        }),
        makeComponent({
          name: 'WLM Diva Monitor',
          role: 'speaker',
          architecture: 'high-efficiency paper-cone monitor',
          confidence: 'high',
          axisPosition: { warm_bright: 'warm', smooth_detailed: 'smooth', elastic_controlled: 'elastic', airy_closed: 'neutral', scale_intimacy: 'neutral' },
        }),
      ],
      activeDACInference: {
        activeDACName: 'Chord Hugo',
        activeDACType: 'standalone',
        multipleDACs: false,
        needsDACClarification: false,
        confidence: 'high',
      },
      powerMatchAssessment: {
        ampName: 'JOB Integrated',
        speakerName: 'WLM Diva Monitor',
        ampPowerWatts: 25,
        speakerSensitivityDb: 96,
        compatibility: 'optimal',
        estimatedMaxCleanSPL: 110,
        relevantInteraction: null,
      },
    });
  }

  it('emits a non-empty emergent paragraph', () => {
    const out = composeEmergentBehavior(makeMySystemFindings());
    expect(out.length).toBeGreaterThan(0);
    expect(out).toMatch(/\*\*Emergent behavior\*\*/);
  });

  it('selects dynamic_elasticity as the primary tag', () => {
    const findings = makeMySystemFindings();
    const fired = TRANSFORMS.map((t) => t(findings)).filter((r): r is NonNullable<typeof r> => !!r);
    const sel = selectEmergentTags(fired);
    expect(sel[0].tag).toBe('dynamic_elasticity');
  });

  it('partners dynamic_elasticity with a distinct second tag (low_drag or temporal_coherence)', () => {
    const findings = makeMySystemFindings();
    const fired = TRANSFORMS.map((t) => t(findings)).filter((r): r is NonNullable<typeof r> => !!r);
    const sel = selectEmergentTags(fired);
    expect(sel.length).toBe(2);
    expect(['low_drag', 'temporal_coherence']).toContain(sel[1].tag);
  });

  it('does NOT fire harmonic_continuity (FPGA explicitly excluded)', () => {
    const findings = makeMySystemFindings();
    const fired = TRANSFORMS.map((t) => t(findings)).filter((r): r is NonNullable<typeof r> => !!r);
    expect(fired.some((r) => r.tag === 'harmonic_continuity')).toBe(false);
  });

  it('does NOT fire system_tension_active (system is coherent)', () => {
    const findings = makeMySystemFindings();
    const fired = TRANSFORMS.map((t) => t(findings)).filter((r): r is NonNullable<typeof r> => !!r);
    expect(fired.some((r) => r.tag === 'system_tension_active')).toBe(false);
  });

  it('renders the My System target wording with the elasticity opener and JOB low-friction phrasing', () => {
    const out = composeEmergentBehavior(makeMySystemFindings());
    // Sentence 1 anchor: speed → elastic motion, NOT "lean corrected by speaker"
    expect(out).toMatch(/speed is converted into elastic motion rather than edge/);
    // Sentence 2 contributor refs: Hugo timing + JOB low-friction + Diva high-efficiency
    expect(out).toMatch(/Hugo's timing precision/i);
    expect(out).toMatch(/JOB's low-friction output/i);
    expect(out).toMatch(/high-efficiency driver/i);
    // Quality clause: microdynamics stay lively/quick/sweet — not "merely lean"
    expect(out).toMatch(/microdynamics stay lively, quick, and sweet instead of merely lean/);
    // Old compensation language must NOT appear in the emergent paragraph
    expect(out).not.toMatch(/supplying all of the warmth/i);
    expect(out).not.toMatch(/prevents thinness/i);
    expect(out).not.toMatch(/compensates/i);
    expect(out).not.toMatch(/corrected by/i);
    // Phrase the user explicitly DID NOT want
    expect(out).not.toMatch(/minimal feedback or damping/i);
  });
});

// ── Tension negative-case ──────────────────────────────────────────

describe('Topping → Hegel → Harbeth — tension case', () => {
  function makeTensionFindings(): MemoFindings {
    return makeFindings({
      isCoherent: false,
      componentVerdicts: [
        makeComponent({
          name: 'Topping D90',
          role: 'dac',
          architecture: 'delta-sigma ESS Sabre',
          confidence: 'high',
          axisPosition: { warm_bright: 'bright', smooth_detailed: 'detailed', elastic_controlled: 'controlled', airy_closed: 'neutral', scale_intimacy: 'neutral' },
        }),
        makeComponent({
          name: 'Hegel H190',
          role: 'integrated',
          architecture: 'SoundEngine feed-forward',
          confidence: 'high',
          axisPosition: { warm_bright: 'bright', smooth_detailed: 'detailed', elastic_controlled: 'controlled', airy_closed: 'neutral', scale_intimacy: 'neutral' },
        }),
        makeComponent({
          name: 'Harbeth Compact 7',
          role: 'speaker',
          architecture: 'BBC thin-wall monitor',
          confidence: 'high',
          axisPosition: { warm_bright: 'warm', smooth_detailed: 'smooth', elastic_controlled: 'neutral', airy_closed: 'neutral', scale_intimacy: 'neutral' },
        }),
      ],
    });
  }

  it('surfaces system_tension_active', () => {
    const out = composeEmergentBehavior(makeTensionFindings());
    expect(out).toMatch(/two opposing voicings stay in tension/i);
  });

  it('does NOT claim low_drag or flow_continuity in a tension chain', () => {
    const out = composeEmergentBehavior(makeTensionFindings());
    expect(out).not.toMatch(/keep musical energy moving through the chain/i);
    expect(out).not.toMatch(/breathes through musical phrasing/i);
  });
});
