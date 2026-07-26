/**
 * Brand house-voicing surfacing into the v2 Assessment Artifact (C1).
 *
 * The gate stack and data layer already had full unit coverage
 * (brand-house-voicing.test.ts). These tests cover the *surfacing* contract:
 * the synthesizer emits `brandNotes` on the payload only when the flag is on
 * and a component's brand clears every gate — and the payload is byte-identical
 * to the pre-surfacing output when the flag is off.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { runArtifactPipeline } from '../../../product/assessment-pipeline';

const FLAG = 'NEXT_PUBLIC_BRAND_HOUSE_VOICING';

// A coherent tube-amp + high-efficiency-speaker system: both brands carry
// approved house-voicing knowledge and clear the gates in this context.
const GOLDEN = 'Assess my system: Denafrips Ares II, Leben CS600, DeVore Orangutan O/96';
// A system whose brands carry no qualifying entry — restraint, no notes.
const RESTRAINT = 'Assess my system: Rega Planar 3, Rega Aethos, Spendor A7';

function withFlag<T>(on: boolean, fn: () => T): T {
  const prev = process.env[FLAG];
  process.env[FLAG] = on ? 'on' : 'off';
  try {
    return fn();
  } finally {
    if (prev === undefined) delete process.env[FLAG];
    else process.env[FLAG] = prev;
  }
}

afterEach(() => {
  delete process.env[FLAG];
});

describe('Brand notes — surfacing when the flag is on', () => {
  it('emits one note per qualifying component, keyed to the resolved component name', () => {
    const notes = withFlag(true, () => runArtifactPipeline(GOLDEN)?.payload.brandNotes);
    expect(notes).toBeDefined();
    const byComponent = new Map((notes ?? []).map((n) => [n.component, n.sentence]));
    // Both the tube integrated and the high-efficiency speaker qualify here.
    expect([...byComponent.keys()].some((c) => /leben/i.test(c))).toBe(true);
    expect([...byComponent.keys()].some((c) => /devore|orangutan/i.test(c))).toBe(true);
    for (const n of notes ?? []) {
      expect(typeof n.sentence).toBe('string');
      expect(n.sentence.trim().length).toBeGreaterThan(0);
    }
  });

  it('holds its restraint — no notes when no brand qualifies', () => {
    const notes = withFlag(true, () => runArtifactPipeline(RESTRAINT)?.payload.brandNotes);
    expect(notes).toBeUndefined();
  });
});

describe('Brand notes — safe-off is byte-identical', () => {
  it('omits brandNotes entirely when the flag is off, even on a qualifying system', () => {
    const off = withFlag(false, () => runArtifactPipeline(GOLDEN)?.payload);
    expect(off).toBeDefined();
    expect('brandNotes' in (off as object)).toBe(false);
  });

  it('flag-off payload equals the payload with brandNotes stripped from flag-on', () => {
    const on = withFlag(true, () => runArtifactPipeline(GOLDEN)?.payload);
    const off = withFlag(false, () => runArtifactPipeline(GOLDEN)?.payload);
    expect(on?.brandNotes).toBeDefined();
    const { brandNotes: _omit, ...onWithout } = on as Record<string, unknown>;
    expect(onWithout).toEqual(off);
  });
});
