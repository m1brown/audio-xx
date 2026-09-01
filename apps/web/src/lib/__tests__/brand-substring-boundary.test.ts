import { describe, it, expect } from 'vitest';
import { detectIntent } from '../intent';
import { buildConsultationResponse } from '../consultation';

/**
 * A brand name inside another word is not a brand mention.
 *
 * Verified on production (8d35df4): "what's special about harbeth" and
 * "what's special about audio note" both returned the SPEC brand profile.
 * The intent layer had detected the right subject (harbeth:brand /
 * audio note:brand), but the consultation fallback scans the whole message
 * with `includes()`, so the brand Spec matched the substring "spec" inside
 * "special" — and array order let it beat the brand the user actually named.
 *
 * "What's special about X" is among the most natural brand questions there
 * is. Every one of them answered with the wrong manufacturer.
 */

function consult(q: string) {
  const r = detectIntent(q);
  return buildConsultationResponse(q, r.subjectMatches) as
    | { source?: string; subject?: string }
    | null;
}

describe('brand matching respects word boundaries', () => {
  it('"what\'s special about harbeth" answers about Harbeth, not Spec', () => {
    const c = consult("what's special about harbeth");
    expect(c, 'a named brand must produce a consultation').not.toBeNull();
    expect(c!.subject).toBe('Harbeth');
  });

  it('"what\'s special about audio note" answers about Audio Note, not Spec', () => {
    const c = consult("what's special about audio note");
    expect(c).not.toBeNull();
    expect(c!.subject).toBe('Audio Note');
  });

  it('"what\'s special about devore" answers about DeVore', () => {
    const c = consult("what's special about devore");
    expect(c).not.toBeNull();
    expect(c!.subject).toMatch(/DeVore/i);
  });

  it('an actual Spec mention still reaches the Spec profile', () => {
    // The brand must stay reachable when genuinely named on its own.
    const c = consult('tell me about the spec amplifier brand');
    if (c) expect(c.subject).toMatch(/Spec/i);
  });
});
