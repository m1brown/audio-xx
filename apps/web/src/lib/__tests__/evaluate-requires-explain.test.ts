import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { verdictFromEvidence } from '../relational-explain';

/**
 * EVALUATE MAY NOT BYPASS EXPLAIN.
 *
 * A verdict is an evaluative conclusion. "Nothing here needs changing" is the
 * most dangerous one in the product, because it is the sentence a listener is
 * most likely to act on and the one that looks most harmless when unfounded.
 * It is licensed by an EXPLAIN-level basis — established relations between
 * components — and never by the absence of a complaint.
 *
 * The bypass this guards against is real: `verdictForVerdictLine` composed a
 * verdict from the declared action label alone, so `no_change` rendered as
 * reassurance with no relation consulted. It had no callers, which is the
 * only reason it never fired.
 */

describe('a verdict is composed from established relations, never from a label', () => {
  it('says nothing is ESTABLISHED — not that nothing needs changing', () => {
    // The distinction is the whole doctrine. "Nothing needs changing" claims a
    // system was examined and found sound; "no interaction is established"
    // reports the truth, which is that Audio XX could not examine it.
    const v = verdictFromEvidence('no_change', []);
    expect(v).toMatch(/No system-level interaction is established/i);
    expect(v).not.toMatch(/nothing here obviously needs changing/i);
  });

  it('names the open gap when it holds one', () => {
    const v = verdictFromEvidence('no_change', [], 'the loudspeaker sensitivity figure');
    expect(v).toMatch(/the loudspeaker sensitivity figure remains unresolved/);
  });

  it('a declared no_change cannot overrule a surviving constraint', () => {
    const v = verdictFromEvidence('no_change', [{ kind: 'constraint', axis: 'power_load' }]);
    expect(v).toMatch(/constraint/i);
    expect(v).not.toMatch(/nothing here/i);
  });

  it('compatibility findings never become a tonal verdict', () => {
    // No number of power/load findings adds up to a statement about voicing.
    const v = verdictFromEvidence('no_change', [
      { kind: 'reinforcement', axis: 'power_load' },
      { kind: 'reinforcement', axis: 'power_load' },
    ]);
    expect(v).toMatch(/compatibility findings/);
    expect(v).not.toMatch(/warm|bright|detailed|voicing|character/i);
  });
});

describe('no second verdict constructor may reintroduce the bypass', () => {
  // The composer moved to `relational-explain` (2026-08-24) so the snapshot
  // layer could reach it without importing a module that carries model prompts
  // and network calls. Both files are checked: the deleted constructor must
  // not reappear in either.
  const src = readFileSync('apps/web/src/lib/relational-explain.ts', 'utf8');
  const llm = readFileSync('apps/web/src/lib/llm-system-inference.ts', 'utf8');

  it('the label-only constructor stays deleted', () => {
    expect(src).not.toMatch(/export function verdictForVerdictLine/);
    expect(llm).not.toMatch(/export function verdictForVerdictLine/);
  });

  it('the surviving constructor reads relations before it speaks', () => {
    const body = src.slice(src.indexOf('export function verdictFromEvidence'));
    const firstReturn = body.indexOf('return');
    // A relations check must precede any sentence the function can emit.
    expect(body.slice(0, firstReturn)).toMatch(/relations\.length === 0/);
  });
});
