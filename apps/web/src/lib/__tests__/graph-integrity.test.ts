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

/*
 * CANONICAL INGESTION SUPERSEDES THE CLARIFY-ON-DROP SHAPE (P1, 2026-09-14).
 *
 * These three fixtures originally pinned `clarification` because resolution
 * DROPPED a typed component (or shed its model down to a bare brand) and the
 * gate's job was to refuse the reduced graph. The message parse is now the
 * canonical component owner: every typed identity seeds the graph verbatim
 * (opaque where the catalog is silent), so the graph these inputs produce is
 * INTACT — and the honest outcome for an intact graph is an assessment that
 * carries the listener's exact identities, not a question asking them to
 * retype a model they already typed. The gate itself is unchanged and still
 * refuses genuinely reduced graphs — see the bare-brand pins below, where the
 * listener really did type only a brand.
 */
describe('graph-integrity — typed identities survive resolution intact', () => {
  it('WiiM / Fosi V3 / Wharfedale assesses with every typed identity intact', () => {
    const r = buildSystemAssessment(
      'Assess my system: WiiM Pro, Fosi Audio V3, Wharfedale Diamond 12.1',
      extractSubjectMatches('Assess my system: WiiM Pro, Fosi Audio V3, Wharfedale Diamond 12.1'),
      null, []) as { kind: string; response?: { systemChain?: { names?: string[] } } };
    expect(r.kind).toBe('assessment');
    const names = (r.response?.systemChain?.names ?? []).map((n) => n.toLowerCase());
    expect(names.some((n) => n.includes('wiim pro'))).toBe(true);
    expect(names.some((n) => n.includes('fosi audio v3'))).toBe(true);
    // The model must not be shed to a bare brand.
    expect(names.some((n) => n.includes('wharfedale diamond 12.1'))).toBe(true);
  });
  it('Bluesound / Cambridge AXA35 / Q Acoustics never assesses a reduced system', () => {
    const M = 'Assess my system: Bluesound Node, Cambridge Audio AXA35, Q Acoustics 3030i';
    const r = buildSystemAssessment(M, extractSubjectMatches(M), null, []) as {
      kind: string; response?: { systemChain?: { names?: string[] } };
    };
    if (r.kind === 'assessment') {
      const names = (r.response?.systemChain?.names ?? []).map((n) => n.toLowerCase());
      expect(names.some((n) => n.includes('axa35'))).toBe(true);
      expect(names.some((n) => n.includes('3030i'))).toBe(true);
    } else {
      // Preserve or ask: honest degradation is the other licensed outcome.
      expect(['clarification', 'low_confidence']).toContain(r.kind);
    }
  });
  it('Denafrips Ares II / Rega Elex Mk4 / Spendor A7 keeps the typed models', () => {
    const M = 'Assess my system: Denafrips Ares II, Rega Elex Mk4, Spendor A7';
    const r = buildSystemAssessment(M, extractSubjectMatches(M), null, []) as {
      kind: string; response?: { systemChain?: { names?: string[] } };
    };
    expect(r.kind).toBe('assessment');
    const names = (r.response?.systemChain?.names ?? []).map((n) => n.toLowerCase());
    expect(names.some((n) => n.includes('elex mk4'))).toBe(true);
    expect(names.some((n) => n.includes('spendor a7'))).toBe(true);
  });
});

describe('graph-integrity gate — genuinely bare brands still clarify', () => {
  it('typed bare brands (Denafrips Ares II / Rega / Spendor) clarify, not assess', () => {
    expect(kindOf('Assess my system: Denafrips Ares II, Rega, Spendor')).toBe('clarification');
  });
  it('the clarification names what was understood and asks for the exact model', () => {
    const c = clarification('Assess my system: Denafrips Ares II, Rega, Spendor');
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
  it('the Wilson duplication no longer occurs: the typed identity survives whole', () => {
    // This fixture used to clarify because resolution split "Wilson Audio
    // Sasha DAW" into duplicate bare-brand records with the model lost.
    // Under canonical ingestion (P1, 2026-09-14) the typed identity is the
    // graph node, so there is nothing to ask about.
    const M = 'Assess my system: dCS Vivaldi, Boulder 866, Wilson Audio Sasha DAW';
    const r = buildSystemAssessment(M, extractSubjectMatches(M), null, []) as {
      kind: string; response?: { systemChain?: { names?: string[] } };
    };
    expect(r.kind).toBe('assessment');
    const names = (r.response?.systemChain?.names ?? []).map((n) => n.toLowerCase());
    expect(names).toContain('wilson audio sasha daw');
    expect(names.filter((n) => n.includes('wilson'))).toHaveLength(1);
  });
});
