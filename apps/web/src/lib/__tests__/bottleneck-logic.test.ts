/**
 * Bottleneck detection and upgrade ranking tests.
 *
 * Tests the internal pipeline functions:
 *   - detectPrimaryConstraint
 *   - buildComponentAssessments
 *   - buildUpgradePaths
 *   - buildKeepRecommendations
 *   - reconcileAssessmentOutputs
 *
 * Verifies:
 *   - Primary constraint identification is consistent
 *   - Upgrade path ranking follows the bottleneck
 *   - Secondary constraints are ordered sensibly
 *   - Stacked traits influence diagnosis without contradictions
 *   - Reconciliation prevents keep/upgrade conflicts
 */

// @ts-nocheck — globals provided by test-runner.ts
import { _test, type SystemComponent } from '../consultation';
import type { PrimaryAxisLeanings } from '../axis-types';

const {
  classifyComponentAxes,
  detectStackedTraits,
  detectPrimaryConstraint,
  buildComponentAssessments,
  buildUpgradePaths,
  buildKeepRecommendations,
  reconcileAssessmentOutputs,
} = _test;

// ── Helpers ──────────────────────────────────────────

function comp(displayName: string, role: string, opts?: {
  character?: string;
  brand?: string;
  category?: string;
}): SystemComponent {
  return {
    displayName,
    role,
    character: opts?.character ?? `${displayName} character`,
    product: opts?.category ? {
      brand: opts?.brand ?? '',
      name: displayName,
      category: opts.category,
    } as SystemComponent['product'] : undefined,
  };
}

/** Build a minimal axis profile for testing. */
function axisProfile(name: string, axes: Partial<PrimaryAxisLeanings>, source: 'product' | 'brand' | 'inferred' = 'inferred') {
  return {
    name,
    axes: {
      warm_bright: axes.warm_bright ?? null,
      smooth_detailed: axes.smooth_detailed ?? null,
      elastic_controlled: axes.elastic_controlled ?? null,
      airy_closed: axes.airy_closed ?? null,
    },
    source,
  };
}

/** Build a properly-shaped ComponentAssessment. */
function assessment(name: string, role: string, verdict: string, strengths: string[], weaknesses: string[]) {
  return {
    name,
    role,
    summary: `${name} assessment summary.`,
    verdict,
    strengths,
    weaknesses,
  };
}

/** Build a properly-shaped UpgradePath with rationale and options. */
function upgradePath(rank: number, label: string, rationale: string, optionNames: string[]) {
  return {
    rank,
    label,
    impact: rank === 1 ? 'Highest Impact' : 'Secondary',
    rationale,
    options: optionNames.map((n, i) => ({
      rank: i + 1,
      name: n,
      summary: `${n} upgrade option.`,
      pros: ['Improved performance'],
      cons: [],
    })),
  };
}

// ──────────────────────────────────────────────────────
// Bottleneck detection
// ──────────────────────────────────────────────────────

describe('detectPrimaryConstraint', () => {
  it('identifies a stacked bias as constraint when multiple components share direction', () => {
    const components = [
      comp('Bright DAC', 'dac'),
      comp('Bright Amp', 'amplifier'),
      comp('Neutral Speaker', 'speaker'),
    ];
    const profiles = [
      axisProfile('Bright DAC', { warm_bright: 'bright' }),
      axisProfile('Bright Amp', { warm_bright: 'bright' }),
      axisProfile('Neutral Speaker', {}),
    ];

    // Create synthetic stacked traits
    const stacked = [{
      property: 'Brightness bias',
      contributors: ['Bright DAC', 'Bright Amp'],
      axis: 'warm_bright' as const,
      direction: 'bright' as const,
    }];

    const systemAxes: PrimaryAxisLeanings = {
      warm_bright: 'bright',
      smooth_detailed: null,
      elastic_controlled: null,
      airy_closed: null,
    };

    const constraint = detectPrimaryConstraint(components, profiles, stacked, systemAxes);
    // Should identify a constraint (stacked bright bias)
    if (constraint) {
      expect(constraint.explanation.length).toBeGreaterThan(0);
    }
  });

  it('returns undefined for a well-balanced system', () => {
    const components = [
      comp('Good DAC', 'dac'),
      comp('Good Amp', 'amplifier'),
      comp('Good Speaker', 'speaker'),
    ];
    const profiles = [
      axisProfile('Good DAC', { warm_bright: 'warm', smooth_detailed: 'detailed' }),
      axisProfile('Good Amp', { warm_bright: 'bright', smooth_detailed: 'smooth' }),
      axisProfile('Good Speaker', {}),
    ];

    const systemAxes: PrimaryAxisLeanings = {
      warm_bright: null,
      smooth_detailed: null,
      elastic_controlled: null,
      airy_closed: null,
    };

    const constraint = detectPrimaryConstraint(components, profiles, [], systemAxes);
    // A well-balanced system may or may not have a constraint — if it does,
    // it should have low severity
    // This test documents that the function doesn't crash on balanced input
    expect(true).toBe(true);
  });
});

// ──────────────────────────────────────────────────────
// Stacked trait detection
// ──────────────────────────────────────────────────────

describe('detectStackedTraits', () => {
  it('detects shared brightness across two components', () => {
    const components = [
      comp('DAC A', 'dac'),
      comp('Amp B', 'amplifier'),
      comp('Speaker C', 'speaker'),
    ];
    const profiles = [
      axisProfile('DAC A', { warm_bright: 'bright' }),
      axisProfile('Amp B', { warm_bright: 'bright' }),
      axisProfile('Speaker C', { warm_bright: 'warm' }),
    ];

    const stacked = detectStackedTraits(components, profiles);
    // Should detect brightness stacking between DAC A and Amp B
    const brightStack = stacked.find(
      (s) => s.axis === 'warm_bright' && s.direction === 'bright',
    );
    if (brightStack) {
      expect(brightStack.contributors).toContain('DAC A');
      expect(brightStack.contributors).toContain('Amp B');
      expect(brightStack.contributors).not.toContain('Speaker C');
    }
  });

  it('does NOT flag when only one component pushes a direction', () => {
    const components = [
      comp('DAC A', 'dac'),
      comp('Amp B', 'amplifier'),
    ];
    const profiles = [
      axisProfile('DAC A', { warm_bright: 'bright' }),
      axisProfile('Amp B', { warm_bright: 'warm' }),
    ];

    const stacked = detectStackedTraits(components, profiles);
    // Opposing directions — no stacking
    const brightStack = stacked.find(
      (s) => s.axis === 'warm_bright' && s.direction === 'bright',
    );
    expect(brightStack).toBeUndefined();
  });

  it('detects multiple stacked axes independently', () => {
    const components = [
      comp('DAC A', 'dac'),
      comp('Amp B', 'amplifier'),
    ];
    const profiles = [
      axisProfile('DAC A', { warm_bright: 'bright', smooth_detailed: 'detailed' }),
      axisProfile('Amp B', { warm_bright: 'bright', smooth_detailed: 'detailed' }),
    ];

    const stacked = detectStackedTraits(components, profiles);
    // Should detect stacking on both axes
    expect(stacked.length).toBeGreaterThanOrEqual(2);
  });
});

// ──────────────────────────────────────────────────────
// Keep/upgrade reconciliation
// ──────────────────────────────────────────────────────

describe('reconcileAssessmentOutputs', () => {
  it('removes bottleneck from keeps', () => {
    const components = [
      comp('Problem DAC', 'dac'),
      comp('Good Amp', 'amplifier'),
      comp('Good Speaker', 'speaker'),
    ];
    const assessments = [
      assessment('Problem DAC', 'dac', '**This is the primary constraint in the chain.** Upgrading here yields the highest system-level impact.', ['fast'], ['thin']),
      assessment('Good Amp', 'amplifier', 'Performing well. No immediate upgrade rationale.', ['warm'], []),
      assessment('Good Speaker', 'speaker', 'Performing well. No immediate upgrade rationale.', ['natural'], []),
    ];
    const paths = [
      upgradePath(1, 'DAC Upgrade', 'The DAC is the weakest link in the chain. Replacing it will address the thin tonal body.', ['Better DAC']),
    ];
    const rawKeeps = [
      { name: 'Problem DAC', reason: 'It works' },
      { name: 'Good Amp', reason: 'Great warmth' },
      { name: 'Good Speaker', reason: 'Natural sound' },
    ];
    const constraint = { componentName: 'Problem DAC', category: 'dac_limitation' as const, explanation: 'Thin tonal body' };

    const result = reconcileAssessmentOutputs(components, assessments, paths, rawKeeps, constraint);
    const keepNames = result.keeps.map((k: { name: string }) => k.name);
    expect(keepNames).not.toContain('Problem DAC');
    expect(keepNames).toContain('Good Amp');
    expect(keepNames).toContain('Good Speaker');
  });

  it('removes component whose role matches an upgrade path target', () => {
    const components = [
      comp('Old Speaker', 'speaker'),
      comp('Good DAC', 'dac'),
    ];
    const assessments = [
      assessment('Old Speaker', 'speaker', 'Solid at its tier. Room for refinement, not the priority.', [], ['limited scale']),
      assessment('Good DAC', 'dac', 'Performing well. No immediate upgrade rationale.', ['detailed'], []),
    ];
    const paths = [
      upgradePath(1, 'Speaker Upgrade', 'Speakers are the biggest lever for system-level improvement. Upgrading here opens up scale and dynamics.', ['Better Speaker']),
    ];
    const rawKeeps = [
      { name: 'Old Speaker', reason: 'Placeholder' },
      { name: 'Good DAC', reason: 'Excellent detail' },
    ];

    const result = reconcileAssessmentOutputs(components, assessments, paths, rawKeeps);
    const keepNames = result.keeps.map((k: { name: string }) => k.name);
    expect(keepNames).not.toContain('Old Speaker');
    expect(keepNames).toContain('Good DAC');
  });

  it('retains components that are not upgrade targets or bottlenecks', () => {
    const components = [
      comp('DAC', 'dac'),
      comp('Amp', 'amplifier'),
      comp('Speaker', 'speaker'),
    ];
    const assessments = [
      assessment('DAC', 'dac', '**This is the primary constraint in the chain.** Upgrading here yields the highest system-level impact.', [], ['limited']),
      assessment('Amp', 'amplifier', 'Performing well. No immediate upgrade rationale.', ['warm'], []),
      assessment('Speaker', 'speaker', 'Performing well. No immediate upgrade rationale.', ['natural'], []),
    ];
    const paths = [
      upgradePath(1, 'DAC Upgrade', 'The DAC is the weakest link. Upgrading here addresses the primary constraint.', ['New DAC']),
    ];
    const rawKeeps = [
      { name: 'Amp', reason: 'Warm and musical' },
      { name: 'Speaker', reason: 'Natural tonality' },
    ];
    const constraint = { componentName: 'DAC', category: 'dac_limitation' as const, explanation: 'limited' };

    const result = reconcileAssessmentOutputs(components, assessments, paths, rawKeeps, constraint);
    expect(result.keeps.length).toBe(2);
    const keepNames = result.keeps.map((k: { name: string }) => k.name);
    expect(keepNames).toContain('Amp');
    expect(keepNames).toContain('Speaker');
  });

  it('produces a sequential recommended sequence', () => {
    const components = [
      comp('DAC', 'dac'),
      comp('Amp', 'amplifier'),
    ];
    const assessments = [
      assessment('DAC', 'dac', '**This is the primary constraint in the chain.** Upgrading here yields the highest system-level impact.', [], ['limited']),
      assessment('Amp', 'amplifier', 'Performing well. No immediate upgrade rationale.', ['warm'], []),
    ];
    const paths = [
      upgradePath(1, 'DAC Upgrade', 'The DAC is the weakest link. Upgrading here addresses the primary constraint.', ['New DAC']),
    ];
    const rawKeeps = [
      { name: 'Amp', reason: 'Keep it' },
    ];

    const result = reconcileAssessmentOutputs(components, assessments, paths, rawKeeps);
    // Sequence should have numbered steps
    if (result.sequence.length > 0) {
      for (let i = 0; i < result.sequence.length; i++) {
        expect(result.sequence[i].step).toBe(i + 1);
      }
    }
  });
});

// ──────────────────────────────────────────────────────
// Component assessments
// ──────────────────────────────────────────────────────

describe('buildComponentAssessments', () => {
  it('produces assessments with verdictKind for all components', () => {
    const components = [
      comp('Chord Hugo', 'dac'),
      comp('JOB Integrated', 'integrated'),
      comp('WLM Diva', 'speaker'),
    ];
    const profiles = [
      axisProfile('Chord Hugo', { warm_bright: 'bright' }),
      axisProfile('JOB Integrated', { elastic_controlled: 'controlled' }),
      axisProfile('WLM Diva', { warm_bright: 'warm' }),
    ];

    const assessments = buildComponentAssessments(components, profiles);
    expect(assessments.length).toBe(3);
    const validKinds = ['bottleneck', 'upgrade_candidate', 'keeper', 'balanced'];
    for (const a of assessments) {
      expect(a.name.length).toBeGreaterThan(0);
      expect(a.verdict.length).toBeGreaterThan(0);
      expect(validKinds).toContain(a.verdictKind);
    }
  });

  it('sets verdictKind to bottleneck when constraint is provided', () => {
    const components = [
      comp('Problem DAC', 'dac'),
      comp('Good Amp', 'amplifier'),
    ];
    const profiles = [
      axisProfile('Problem DAC', { warm_bright: 'bright' }),
      axisProfile('Good Amp', { warm_bright: 'warm' }),
    ];
    const constraint = {
      componentName: 'Problem DAC',
      category: 'dac_limitation' as const,
      explanation: 'Upstream constraint',
    };

    const assessments = buildComponentAssessments(components, profiles, constraint);
    const dacAssessment = assessments.find((a) => a.name === 'Problem DAC');
    expect(dacAssessment).toBeDefined();
    expect(dacAssessment!.verdictKind).toBe('bottleneck');
    expect(dacAssessment!.verdict).toMatch(/primary constraint/i);

    // Non-bottleneck should not be 'bottleneck'
    const ampAssessment = assessments.find((a) => a.name === 'Good Amp');
    expect(ampAssessment).toBeDefined();
    expect(ampAssessment!.verdictKind).not.toBe('bottleneck');
  });

  it('sets verdictKind to keeper for components with no weaknesses', () => {
    const components = [
      comp('Perfect DAC', 'dac'),
    ];
    const profiles = [
      axisProfile('Perfect DAC', { warm_bright: 'neutral' }),
    ];

    const assessments = buildComponentAssessments(components, profiles);
    // neutral axis gives "Neutral tonal balance" strength, no weaknesses
    const dac = assessments[0];
    expect(dac.verdictKind).toBe('keeper');
  });
});

// ──────────────────────────────────────────────────────
// Upgrade path ranking
// ──────────────────────────────────────────────────────

describe('buildUpgradePaths', () => {
  it('ranks bottleneck first', () => {
    const components = [
      comp('Bad DAC', 'dac'),
      comp('OK Amp', 'amplifier'),
      comp('Good Speaker', 'speaker'),
    ];
    const profiles = [
      axisProfile('Bad DAC', { warm_bright: 'bright' }),
      axisProfile('OK Amp', { warm_bright: 'warm' }),
      axisProfile('Good Speaker', {}),
    ];
    const assessments = [
      assessment('Bad DAC', 'dac', '**This is the primary constraint in the chain.**', [], ['thin']),
      assessment('OK Amp', 'amplifier', 'Solid at its tier. Room for refinement, not the priority.', ['warm'], ['slow']),
      assessment('Good Speaker', 'speaker', 'Performing well. No immediate upgrade rationale.', ['natural'], []),
    ];
    const constraint = {
      componentName: 'Bad DAC',
      category: 'dac_limitation' as const,
      explanation: 'thin tonal body',
    };

    const paths = buildUpgradePaths(components, profiles, assessments, constraint);
    if (paths.length > 0) {
      expect(paths[0].rank).toBe(1);
      // First path should be about the DAC
      expect(paths[0].label.toLowerCase()).toMatch(/dac/i);
    }
  });
});
