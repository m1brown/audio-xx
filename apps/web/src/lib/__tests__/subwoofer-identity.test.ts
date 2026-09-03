/**
 * Powered-subwoofer identity (launch-blocker P1, 2026-09-03).
 *
 * "…KEF LS50 Meta speakers, SVS SB-1000 Pro subwoofer" stalled at
 * "one component I couldn't match": the extraction vocabulary had no
 * subwoofer role, so the market's most common 2.1 shape (SVS/RSL subs in
 * a third of observed real systems) could not be assessed. The sub is now
 * a first-class category/role — distinct from 'speaker', so it can never
 * trip the duplicate-role gate against the mains.
 */
import { describe, it, expect } from 'vitest';
import { buildTurnContext } from '../turn-context';
import { buildSystemAssessment } from '../consultation';
import type { AudioSessionState } from '../system-types';

const GUEST: AudioSessionState = {
  activeSystemRef: { kind: 'none' } as AudioSessionState['activeSystemRef'],
  savedSystems: [], draftSystem: null, loading: false, proposedSystem: null,
};

describe('a source → amp → speakers + powered sub system assesses', () => {
  const M = 'Assess my system: Eversolo DMP-A6 Gen 2 streamer, Hegel H150 amplifier, KEF LS50 Meta speakers, SVS SB-1000 Pro subwoofer';

  it('all four components parse, the sub with its own role', () => {
    const tc = buildTurnContext(M, GUEST, new Set(), undefined);
    const comps = tc.proposedSystem?.components ?? [];
    expect(comps).toHaveLength(4);
    const sub = comps.find((c) => /sb-1000/i.test(`${c.brand} ${c.name}`));
    expect(sub?.category).toBe('subwoofer');
    const mains = comps.find((c) => /ls50/i.test(`${c.brand} ${c.name}`));
    expect(mains?.category).toBe('speaker');
  });

  it('the assessment proceeds — no unmatched-component clarification', () => {
    const tc = buildTurnContext(M, GUEST, new Set(), undefined);
    const r = buildSystemAssessment(M, tc.subjectMatches, tc.activeSystem, []) as { kind?: string };
    expect(r?.kind).not.toBe('clarification');
  });

  it('other sub brands parse through the same vocabulary (RSL, REL)', () => {
    const tc = buildTurnContext('Assess my system: WiiM Amp, ELAC Debut 3.0 DB63 speakers, RSL Speedwoofer 10S subwoofer', GUEST, new Set(), undefined);
    const comps = tc.proposedSystem?.components ?? [];
    expect(comps.length).toBeGreaterThanOrEqual(3);
    expect(comps.some((c) => c.category === 'subwoofer')).toBe(true);
  });
});
