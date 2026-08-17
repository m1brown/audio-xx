import { describe, it, expect } from 'vitest';
import { buildProvisionalPrompt, computeComponentProvenance } from '../llm-system-inference';

/**
 * GOVERNING INVARIANT (founder, 2026-08-17):
 *
 *   The prose may not reason from an evidence state different from the one
 *   used to compute component provenance.
 *
 * Production made the divergence visible. Pre-generation provenance was
 * stable, rendered provenance was stable, all four beta components corroborated
 * — and the assessment still opened
 *
 *   "the ultimate coherence is indeterminate due to unknown components"
 *
 * The prompt was assembled from "is it in the catalog?" rather than from the
 * evidence state. Its closing line said, unconditionally, to "state explicitly
 * which system-level questions cannot be answered until the unresolved
 * components are identified" — and `unresolved` meant "no catalog row", which
 * was true of three components we had just verified against their
 * manufacturers. The model was following instructions.
 */

const BETA = ['dCS Rossini Apex', 'ARC ref 5', 'Butler Monads', 'Acora QRC-2'];
const DCS_BRAND = [{ name: 'dCS Rossini Apex', character: 'dCS designs lean neutral-to-cool.',
  source: 'brand' as const }];
const ROLES = [
  { name: 'dCS Rossini Apex', role: 'dac' },
  { name: 'ARC ref 5', role: 'preamplifier' },
  { name: 'Butler Monads', role: 'amplifier' },
  { name: 'Acora QRC-2', role: 'speaker' },
];
const ALL_CORROBORATED = ['ARC ref 5', 'Butler Monads', 'Acora QRC-2'];

const betaPrompt = () =>
  buildProvisionalPrompt('Assess my system', BETA, DCS_BRAND, ROLES, ALL_CORROBORATED, []);

describe('the fully corroborated beta system', () => {
  const { userPrompt, provenance } = betaPrompt();

  it('reports the expected basis for all four components', () => {
    expect(Object.fromEntries(provenance.map((p) => [p.name, p.basis]))).toEqual({
      'dCS Rossini Apex': 'brand',
      'ARC ref 5': 'model',
      'Butler Monads': 'model',
      'Acora QRC-2': 'model',
    });
  });

  it('returns the SAME provenance the caller would compute', () => {
    expect(provenance).toEqual(
      computeComponentProvenance(BETA, DCS_BRAND, ALL_CORROBORATED),
    );
  });

  it('never instructs the model to defer for want of identification', () => {
    // The exact instruction that produced the contradiction.
    expect(userPrompt).not.toMatch(/cannot be answered until/i);
    expect(userPrompt).not.toMatch(/unresolved positions/i);
  });

  it('states positively that nothing here is unidentified', () => {
    expect(userPrompt).toMatch(/Every component in this chain carries evidence/i);
    expect(userPrompt).toMatch(/nothing here is unidentified/i);
  });

  it('lists the corroborated components as identity-verified', () => {
    expect(userPrompt).toMatch(/IDENTITY VERIFIED/);
    for (const n of ALL_CORROBORATED) expect(userPrompt).toContain(n);
    expect(userPrompt).toMatch(/Do not describe them as unknown, unidentified or unverified/i);
  });

  it('opens no unverified or incomplete section at all', () => {
    expect(userPrompt).not.toMatch(/IDENTITY NOT VERIFIED/);
    expect(userPrompt).not.toMatch(/IDENTITY CHECK DID NOT COMPLETE/);
  });

  it('scopes brand evidence to the maker, not the model', () => {
    expect(userPrompt).toMatch(/BRAND EVIDENCE/);
    expect(userPrompt).toMatch(/evidence about the MAKER, not this model/i);
  });
});

describe('a genuinely unresolved component still defers — and only then', () => {
  const withFiction = [...BETA, 'Zorblax ZX1 5 watt SET'];
  const { userPrompt, provenance } = buildProvisionalPrompt(
    'Assess my system', withFiction, DCS_BRAND,
    [...ROLES, { name: 'Zorblax ZX1 5 watt SET', role: 'amplifier' }],
    ALL_CORROBORATED, [],
  );

  it('puts only the fictional component at user basis', () => {
    const b = Object.fromEntries(provenance.map((p) => [p.name, p.basis]));
    expect(b['Zorblax ZX1 5 watt SET']).toBe('user');
    expect(b['Acora QRC-2']).toBe('model');
  });

  it('restores the deferral instruction, scoped to that component', () => {
    expect(userPrompt).toMatch(/cannot be answered until those specific components are resolved/i);
    expect(userPrompt).toMatch(/IDENTITY NOT VERIFIED[\s\S]*Zorblax/);
  });

  it('does not sweep the corroborated components into the unverified list', () => {
    const section = userPrompt.match(/IDENTITY NOT VERIFIED[\s\S]*?(?=\n\nIDENTITY|$)/)?.[0] ?? '';
    for (const n of ALL_CORROBORATED) expect(section).not.toContain(n);
  });
});

describe('an incomplete lookup is separated from a genuine finding', () => {
  const { userPrompt } = buildProvisionalPrompt(
    'Assess my system', BETA, DCS_BRAND, ROLES,
    ['ARC ref 5', 'Butler Monads'], ['Acora QRC-2'],
  );

  it('files the failed lookup under incomplete, not unverified', () => {
    expect(userPrompt).toMatch(/IDENTITY CHECK DID NOT COMPLETE[\s\S]*Acora/);
    expect(userPrompt).not.toMatch(/IDENTITY NOT VERIFIED/);
  });

  it('forbids telling the listener the product is unidentified', () => {
    expect(userPrompt).toMatch(/Do NOT say the product is unidentified/i);
    expect(userPrompt).toMatch(/failure on our side/i);
  });
});
