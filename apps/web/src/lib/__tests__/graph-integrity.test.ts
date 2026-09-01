/**
 * Gate 6 remediation (G6-D1) — graph-integrity gate.
 *
 * When the parsed component graph cannot be trusted — a listed component was
 * dropped, one component was duplicated/mis-bound, or two-plus models resolved
 * only to a bare brand — the engine must ask a specific clarification instead
 * of synthesising an assessment from a graph it does not trust. It must NOT
 * over-block a system it can trust.
 */
import { describe, it, expect } from 'vitest';
import { buildSystemAssessment } from '../consultation';
import { extractSubjectMatches } from '../intent';

function kindOf(text: string): string {
  const r = buildSystemAssessment(text, extractSubjectMatches(text), null, []);
  if (!r) return 'null';
  return r.kind;
}
function clarification(text: string) {
  const r = buildSystemAssessment(text, extractSubjectMatches(text), null, []);
  return r && r.kind === 'clarification' ? r.clarification : null;
}

describe('graph-integrity gate — known Gate 6 failures must clarify', () => {
  it('dropped amplifier (WiiM / Fosi V3 / Wharfedale) clarifies, not assesses', () => {
    expect(kindOf('Assess my system: WiiM Pro, Fosi Audio V3, Wharfedale Diamond 12.1')).toBe('clarification');
  });
  it('dropped speaker (Bluesound / Cambridge AXA35 / Q Acoustics) clarifies', () => {
    expect(kindOf('Assess my system: Bluesound Node, Cambridge Audio AXA35, Q Acoustics 3030i')).toBe('clarification');
  });
  it('bare-brand amp+speaker (Denafrips Ares II / Rega Elex Mk4 / Spendor A7) clarifies', () => {
    expect(kindOf('Assess my system: Denafrips Ares II, Rega Elex Mk4, Spendor A7')).toBe('clarification');
  });
  it('the clarification names what was understood and asks for the exact model', () => {
    const c = clarification('Assess my system: WiiM Pro, Fosi Audio V3, Wharfedale Diamond 12.1');
    expect(c).not.toBeNull();
    expect(c!.question).toMatch(/exact make and model/i);
    // it must not generically ask the user to re-enter the whole system
    expect(c!.question).not.toMatch(/re-?enter|start over|list your (?:whole|entire|full) system/i);
  });
});

describe('graph-integrity gate — controls must NOT over-block', () => {
  const ASSESS = [
    ['fully cataloged', 'Assess my system: Chord Qutest, Naim SuperNait 3, Harbeth Super HL5 Plus'],
    ['one uncatalogued model, intact graph', 'Assess my system: Bluesound Node, Hegel H190, KEF LS50 Meta'],
    ['labelled accessory does not inflate count', 'Assess my system: Chord Qutest, Naim SuperNait 3, Harbeth Super HL5 Plus, speaker cables: Canare 4S11G Star Quad'],
    ['duplicate user wording', 'Assess my system: Naim SuperNait 3, Naim SuperNait 3, KEF LS50 Meta'],
    ['role-labelled reported system', 'Assess my system: Streamer Eversolo DMP-A6, Amplifier JOB Job integrated, Speakers WLM Diva monitor, Dac Chord Hugo'],
    ['speaker-cable case stays fixed', 'Assess my system: Eversolo DMP-A6, JOB integrated, WLM Diva monitor, Chord Hugo, speaker cables: Canare 4S11G Star Quad'],
    ['slash model names (DeVore O/96)', 'Assess my system: Leben CS600X, DeVore O/96'],
    ['spurious bare-brand echo of a cataloged unit', 'My system: WiiM Pro → Chord Hugo → Crayon CIA-1 → XSA Vanguard'],
  ] as const;
  for (const [label, text] of ASSESS) {
    it(`assesses: ${label}`, () => {
      expect(kindOf(text)).toBe('assessment');
    });
  }
});

describe('graph-integrity gate — genuine duplication still clarifies', () => {
  it('two bare-brand duplicates with no cataloged model (Wilson) clarifies', () => {
    expect(kindOf('Assess my system: dCS Vivaldi, Boulder 866, Wilson Audio Sasha DAW')).toBe('clarification');
  });
});
