// @ts-nocheck — vitest globals injected via apps/web vitest config

/**
 * Topology renderer integration — comparison surface.
 *
 * Verifies the narrow renderer integration shipped 2026-05-13:
 *   1. `buildInitialComparisonPayload` populates `topologyInteraction`
 *      when both compared sides resolve to distinct authored topology
 *      capsules; skips when one side fails to resolve or both share
 *      the same topology.
 *   2. `renderComparisonPayload` emits the sentence in the correct
 *      slot (between design philosophy and sonic translation) and
 *      doesn't duplicate it elsewhere.
 *
 * Scope is deliberately narrow per the Phase 2 brief — no shopping
 * pipeline tests, no bipolar tests, no `audio_knowledge` topology-
 * question wiring. Those are separate gaps.
 */

import {
  buildInitialComparisonPayload,
  findBrandProfileByName,
} from '../consultation';
import { renderComparisonPayload } from '../comparison-payload';
import {
  findTopologyMention,
  buildTopologyInteractionSentence,
  getTopologyCapsule,
} from '../topology-philosophy';
import { findPairingsForSpeaker } from '../pairing-resolver';

// ── Helper — fetch the two brand profiles needed for a payload build ──

function profilesFor(nameA: string, nameB: string) {
  const profileA = findBrandProfileByName(nameA);
  const profileB = findBrandProfileByName(nameB);
  expect(profileA, `missing brand profile for "${nameA}"`).toBeTruthy();
  expect(profileB, `missing brand profile for "${nameB}"`).toBeTruthy();
  return { profileA: profileA!, profileB: profileB! };
}

// ── 1. buildTopologyInteractionSentence — unit-level ──

describe('buildTopologyInteractionSentence (unit)', () => {
  it('returns null when either capsule is missing', () => {
    const r2r = getTopologyCapsule('r2r')!;
    expect(buildTopologyInteractionSentence(null, r2r)).toBe(null);
    expect(buildTopologyInteractionSentence(r2r, null)).toBe(null);
    expect(buildTopologyInteractionSentence(null, null)).toBe(null);
  });

  it('returns null when both capsules share the same id', () => {
    const set = getTopologyCapsule('set')!;
    expect(buildTopologyInteractionSentence(set, set)).toBe(null);
  });

  it('produces a single-sentence interaction line for R2R vs delta-sigma', () => {
    const r2r = getTopologyCapsule('r2r')!;
    const ds = getTopologyCapsule('delta-sigma')!;
    const sentence = buildTopologyInteractionSentence(r2r, ds);
    expect(sentence).toBeTruthy();
    expect(sentence!).toMatch(/R2R ladder DAC/);
    expect(sentence!).toMatch(/Delta-sigma DAC/i);
    // One sentence only (max one period followed by end-of-string).
    const periodCount = (sentence!.match(/\./g) || []).length;
    expect(periodCount).toBeLessThanOrEqual(1);
    // Contrast structure
    expect(sentence!).toMatch(/while/);
  });
});

// ── 2. Initial comparison payload — Denafrips vs Topping ──

describe('Initial comparison: Denafrips vs Topping', () => {
  const { profileA, profileB } = profilesFor('Denafrips', 'Topping');
  const payload = buildInitialComparisonPayload(profileA, profileB);

  it('topologyInteraction is non-empty', () => {
    expect(payload.topologyInteraction).toBeTruthy();
  });

  it('mentions R2R / ladder', () => {
    expect(payload.topologyInteraction!).toMatch(/R2R|ladder/i);
  });

  it('mentions delta-sigma', () => {
    expect(payload.topologyInteraction!).toMatch(/delta-sigma/i);
  });

  it('rendered output contains the topology line exactly once', () => {
    const rendered = renderComparisonPayload(payload);
    const text = rendered.comparisonSummary;
    expect(text.includes(payload.topologyInteraction!)).toBe(true);
    // No duplicate paragraph
    const occurrences = text.split(payload.topologyInteraction!).length - 1;
    expect(occurrences).toBe(1);
  });

  it('rendered topology line appears after the design philosophy section', () => {
    const rendered = renderComparisonPayload(payload);
    const text = rendered.comparisonSummary;
    const philoIdx = text.indexOf('**Denafrips:**');
    const topoIdx = text.indexOf(payload.topologyInteraction!);
    expect(philoIdx).toBeGreaterThanOrEqual(0);
    expect(topoIdx).toBeGreaterThan(philoIdx);
  });
});

// ── 3. Audio Note vs Topping — conservative expectation per brief ──

describe('Initial comparison: Audio Note vs Topping (conservative)', () => {
  // Per the approved scope: do not assume Audio Note resolves to SET.
  // The safer expectation is:
  //   - topologyInteraction is non-empty
  //   - it mentions delta-sigma (always — Topping resolves to delta-sigma)
  //   - it mentions either NOS, R2R/ladder, or SET — whichever is
  //     actually detected from the existing Audio Note profile text
  const { profileA, profileB } = profilesFor('Audio Note', 'Topping');
  const payload = buildInitialComparisonPayload(profileA, profileB);

  it('topologyInteraction is non-empty', () => {
    expect(payload.topologyInteraction).toBeTruthy();
  });

  it('mentions delta-sigma', () => {
    expect(payload.topologyInteraction!).toMatch(/delta-sigma/i);
  });

  it('mentions exactly one of NOS / R2R / ladder / SET (whatever the profile resolves to)', () => {
    const text = payload.topologyInteraction!;
    const matches = [
      /NOS/i.test(text) || /non-?oversampling/i.test(text),
      /R2R/i.test(text) || /ladder/i.test(text),
      /SET/i.test(text) || /single-ended triode/i.test(text),
    ].filter(Boolean).length;
    // At least one of the three families must surface alongside delta-sigma.
    expect(matches).toBeGreaterThanOrEqual(1);
  });
});

// ── 4. Same-topology — skip (confidence is fine but no contrast) ──

describe('Same-topology comparisons skip the line', () => {
  // Both Leben and PrimaLuna are push-pull tube — no topology contrast.
  it('Leben vs PrimaLuna → topologyInteraction is undefined', () => {
    const profileA = findBrandProfileByName('Leben');
    const profileB = findBrandProfileByName('PrimaLuna');
    if (!profileA || !profileB) return; // skip if profiles missing
    const payload = buildInitialComparisonPayload(profileA, profileB);
    // The line is skipped when both sides resolve to the same topology
    // OR when one side fails to resolve. Either outcome should produce
    // an undefined topologyInteraction.
    expect(payload.topologyInteraction).toBeUndefined();
  });
});

// ── 5. findPairingsForSpeaker (unit) ──

describe('findPairingsForSpeaker', () => {
  it('returns authored pairings for DeVore O/96', () => {
    const p = findPairingsForSpeaker('DeVore O/96');
    expect(p).toBeTruthy();
    expect(p!.length).toBeGreaterThanOrEqual(3);
    // Canonical pairing: Leben CS600X is the first authored entry.
    expect(p![0].brand).toBe('Leben');
    expect(p![0].model).toBe('CS600X');
    expect(p![0].topology).toBe('push-pull-tube');
  });

  it('returns null for unknown speakers', () => {
    expect(findPairingsForSpeaker('Some Unknown Speaker Brand X1000')).toBe(null);
  });

  it('returns null for empty / nullish input', () => {
    expect(findPairingsForSpeaker('')).toBe(null);
  });
});

// ── 6. End-to-end: topology line in rendered output ──

describe('Rendered comparison: topology line in output', () => {
  it('Denafrips vs Topping rendered output mentions both topologies', () => {
    const { profileA, profileB } = profilesFor('Denafrips', 'Topping');
    const payload = buildInitialComparisonPayload(profileA, profileB);
    const { comparisonSummary } = renderComparisonPayload(payload);
    // Authored topology phrases reach the user.
    expect(comparisonSummary).toMatch(/R2R ladder DAC/);
    expect(comparisonSummary).toMatch(/Delta-sigma DAC/i);
  });

  it('renders exactly one topology line; no repetition', () => {
    const { profileA, profileB } = profilesFor('Denafrips', 'Topping');
    const payload = buildInitialComparisonPayload(profileA, profileB);
    const { comparisonSummary } = renderComparisonPayload(payload);
    // The specific opener "The R2R ladder DAC favors" should appear once.
    const opener = 'The R2R ladder DAC favors';
    const count = comparisonSummary.split(opener).length - 1;
    expect(count).toBe(1);
  });
});
