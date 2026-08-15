import { describe, it, expect } from 'vitest';
import { detectSystemDescription } from '../system-extraction';
import { extractSubjectMatches } from '../intent';
import { reconcileWithLabels, preferUserSuppliedName } from '../labelled-components';

/**
 * Surface consistency + consolidated coverage — beta closures (2026-08-15).
 *
 * Three surfaces have to agree about what components a message describes: the
 * assessment graph, the recognition line, and the save-system banner. The beta
 * defect was that each reconstructed the list independently, so the graph held
 * four components while the other two still read "Dcs, ARC". They now share
 * one matching rule (`reconcileWithLabels`) and one naming rule
 * (`preferUserSuppliedName`) rather than three reconstructions.
 */
const BETA_INPUT =
  'Assess my system: Pre-amp: ARC ref 5 Amps: Butler Monads Dac/Streamer: dCS Rossini Apex Speakers: Acora QRC-2';

const BETA_COMPONENTS = ['ARC ref 5', 'Butler Monads', 'dCS Rossini Apex', 'Acora QRC-2'];

const proposedFor = (message: string) => {
  const state = { activeSystemId: null, systems: [], proposedSystem: null };
  return detectSystemDescription(
    message,
    extractSubjectMatches(message),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    state as any,
  );
};

describe('the save-system surface shows what the listener supplied', () => {
  const proposed = proposedFor(BETA_INPUT);

  it('all four beta components appear', () => {
    const names = (proposed?.components ?? []).map((c) => `${c.brand} ${c.name}`.trim());
    for (const expected of BETA_COMPONENTS) expect(names).toContain(expected);
  });

  it('unresolved status is not mistaken for absence', () => {
    // Butler and Acora are not in BRAND_NAMES and never will be for this test.
    // They must still be present — uncatalogued is not the same as unmentioned.
    const names = (proposed?.components ?? []).map((c) => `${c.brand} ${c.name}`.trim());
    expect(names).toContain('Butler Monads');
    expect(names).toContain('Acora QRC-2');
  });

  it('the listener’s fuller designation beats a bare brand match', () => {
    const names = (proposed?.components ?? []).map((c) => `${c.brand} ${c.name}`.trim());
    expect(names).toContain('dCS Rossini Apex');
    expect(names).not.toContain('Dcs');
    expect(names).not.toContain('ARC');
  });

  it('the naming rule is shared, not reimplemented', () => {
    expect(preferUserSuppliedName('Dcs', 'dCS Rossini Apex')).toBe('dCS Rossini Apex');
    expect(preferUserSuppliedName('Chord Hugo TT2', 'Hugo')).toBe('Chord Hugo TT2');
  });

  it('unlabelled prose is granted no label-derived structure here either', () => {
    expect(reconcileWithLabels('I have a Leben CS300 and Harbeth P3ESR', []).hasLabels).toBe(false);
  });
});
