/**
 * Launch QA — regression tests for Launch Mode product-bug fixes.
 *
 * Each test pins a specific benchmark failure from
 * audit-2026-07-02/launch-qa (see ROOT-CAUSE.md) so the wrong behaviour
 * cannot silently return. Tests exercise the deterministic engine
 * exactly as the benchmark harness does: guest state, single turn.
 */
import { describe, it, expect } from 'vitest';
import { buildTurnContext } from '../turn-context';
import { buildSystemAssessment } from '../consultation';
import type { AudioSessionState } from '../system-types';

const GUEST_AUDIO_STATE: AudioSessionState = {
  activeSystemRef: { kind: 'none' } as AudioSessionState['activeSystemRef'],
  savedSystems: [],
  draftSystem: null,
  loading: false,
  proposedSystem: null,
};

function assess(prompt: string): string {
  const turnCtx = buildTurnContext(prompt, GUEST_AUDIO_STATE, new Set(), undefined);
  const result: any = buildSystemAssessment(
    prompt,
    turnCtx.subjectMatches,
    turnCtx.activeSystem,
    turnCtx.desires,
  );
  return JSON.stringify(result ?? {});
}

describe('SA-06 regression: constraint labels are direction-aware', () => {
  // The AHB2 leans detailed + controlled. Before the fix, constrainedAxes
  // rendered its own character poles as deficits: "limits inner detail
  // and texture and rhythmic flow and grip" — its strengths phrased as
  // what it takes away.
  it('never claims a detailed/controlled component limits inner detail or grip', () => {
    const text = assess('Assess my system: Magnepan 1.7i, Benchmark AHB2');
    expect(text).not.toMatch(/limits inner detail and texture and rhythmic flow and grip/i);
    expect(text).not.toMatch(/reduces inner detail and texture and rhythmic flow and grip/i);
    expect(text).not.toMatch(/(AHB2|ahb2)[^.]{0,40}limits inner detail/);
  });

  it('SA-05: a warm/elastic SET is never said to limit tonal weight or flow', () => {
    const text = assess('Assess my system: Klipsch Cornwall IV, Decware SE84UFO');
    expect(text).not.toMatch(/(SE84UFO|se84ufo|Se84ufo)[^.]{0,40}limits tonal weight/);
    expect(text).not.toMatch(/limits tonal weight and body and rhythmic flow and grip/i);
  });
});
