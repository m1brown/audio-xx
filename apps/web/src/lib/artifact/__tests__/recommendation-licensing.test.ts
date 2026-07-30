/**
 * Doctrine D-8 — Recommendation Licensing.
 *
 * A recommendation may be generated only from something the assessment
 * established (an identified limitation / explicit trade-off / stated listener
 * priority). A tonal characteristic must not be converted into a hypothetical
 * deficiency to manufacture an upgrade. When no action is licensed, the output
 * is an explicit no-change recommendation.
 *
 * These cover the four representative states the founder named, plus a guard
 * that the retired tonal-lean hypotheticals never reappear in the Assessment.
 */
import { describe, it, expect } from 'vitest';
import { runArtifactPipeline } from '../../../product/assessment-pipeline';

// Phase 3: no-change close is character-keyed; this suite protects the no-change STATE.
const NO_CHANGE = /nothing here to fix — only flavours to trade|already well balanced/;
const NO_CHANGE_COST = 'If you want more of something, name the quality you’re looking for.';

// Retired hypothetical-deficiency phrases — must never appear anywhere.
const HYPOTHETICALS =
  /if the system feels loose|feels overdamped|feels analytically intense|if you want to add clarity without losing|add warmth and flow without|more detail and presence without the ease|^if you ever want more/i;

const SYSTEMS = {
  coherentNoLimitation: 'Assess my system: Chord Qutest, Naim SuperNait 3, Harbeth Super HL5 Plus',
  coherentWithTradeoff: 'Assess my system: Chord Hugo, Yamamoto A-08S, DeVore Orangutan O/96',
  genuineBottleneck: 'Assess my system: Chord Qutest, Yamamoto A-08S, Magico A3',
  statedPriority: 'Assess my system: Chord Qutest, Naim SuperNait 3, Harbeth Super HL5 Plus. I want more warmth.',
};

function paras(sys: string) {
  const p = runArtifactPipeline(sys)!.payload;
  return { p, all: [p.recognition, ...p.caseParagraphs, p.recommendation, p.cost ?? ''].join('\n') };
}

describe('D-8 — no unlicensed speculation anywhere, in any state', () => {
  for (const [label, sys] of Object.entries(SYSTEMS)) {
    it(`${label}: no forward-look paragraph, no fabricated "if it feels X" deficiency`, () => {
      const { p, all } = paras(sys);
      expect(p.caseParagraphs.some((c) => /^If you ever want more/i.test(c))).toBe(false);
      expect(all).not.toMatch(HYPOTHETICALS);
    });
  }
});

describe('D-8 — recommendation is licensed by the assessment', () => {
  it('coherent, no identified limitation → explicit no-change recommendation', () => {
    const { p } = paras(SYSTEMS.coherentNoLimitation);
    expect(p.recommendation).toMatch(NO_CHANGE);
    expect(p.cost).toBe(NO_CHANGE_COST);
  });

  it('coherent with an explicit trade-off → still no-change (the trade-off is described, no action licensed)', () => {
    const { p } = paras(SYSTEMS.coherentWithTradeoff);
    // The trade-off lives in the Assessment — either the component-specific
    // frame ("The trade — …", preferred under D-10 Resolution) or the archetype
    // frame ("… gives up on purpose …") — never the Recommendation.
    expect(p.caseParagraphs.join('\n')).toMatch(/^the trade —|gives up on purpose|deliberate cost|picked its direction/im);
    expect(p.recommendation).toMatch(NO_CHANGE);
  });

  it('genuine bottleneck → recommendation acts on the identified limitation, not no-change', () => {
    const { p } = paras(SYSTEMS.genuineBottleneck);
    expect(p.recommendation).not.toMatch(NO_CHANGE);
    expect(p.recommendation).toMatch(/power mismatch|amplifier|speakers|power/i);
  });

  it('stated listener priority → no fabricated deficiency; recommendation stays licensed', () => {
    const { p, all } = paras(SYSTEMS.statedPriority);
    // The priority is not yet wired into a directed action; the correct behaviour
    // is still an honest, licensed recommendation — never a manufactured weakness.
    expect(all).not.toMatch(HYPOTHETICALS);
    expect(p.recommendation).toMatch(NO_CHANGE);
  });
});
