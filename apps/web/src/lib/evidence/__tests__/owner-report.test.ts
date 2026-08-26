import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  admitOwnerReport, ownerConsensus, ownerStatement, isPairingReport,
  type OwnerReport,
} from '../owner-report';

const report = (o: Partial<OwnerReport> = {}): OwnerReport => ({
  platform: 'Reddit', sourceUrl: 'https://reddit.com/r/audiophile/x',
  author: 'someone', productKeys: ['k'], productNames: ['Thing'],
  basis: 'stated_owner', associatedEquipment: [], claim: 'It sounded warm.',
  retrievedAt: 0, ...o,
});

describe('owner evidence is its own class and never converts', () => {
  it('shares no module with the professional-review store', () => {
    const src = readFileSync(join(__dirname, '..', 'owner-report.ts'), 'utf8');
    const imports = [...src.matchAll(/from '([^']+)'/g)].map((m) => m[1]);
    // No import at all — nothing to merge with, by construction.
    expect(imports).toEqual([]);
  });

  it('exposes no promotion path to review evidence', () => {
    const src = readFileSync(join(__dirname, '..', 'owner-report.ts'), 'utf8');
    // Comments discuss the review store by name; the CODE must not touch it.
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(code).not.toMatch(/ReviewObservation|toReviewObservation|promote/);
  });
});

describe('admission', () => {
  it('rejects a platform with no durable attribution', () => {
    expect(admitOwnerReport(report({ platform: 'Some Blog' })))
      .toMatchObject({ admitted: false, reason: 'platform_not_recognised' });
  });

  it('rejects a poster whose ownership is not established', () => {
    expect(admitOwnerReport(report({ basis: 'unclear' })))
      .toMatchObject({ admitted: false, reason: 'ownership_not_established' });
  });

  it('rejects an unattributed post', () => {
    expect(admitOwnerReport(report({ author: '  ' })))
      .toMatchObject({ admitted: false, reason: 'missing_attribution' });
  });

  it('rejects a pairing claim with no system context', () => {
    // "These two sound great together" is unusable without the rest of the
    // chain — those are the variables the claim silently holds constant.
    expect(admitOwnerReport(report({
      productKeys: ['a', 'b'], productNames: ['A', 'B'], associatedEquipment: [],
    }))).toMatchObject({ admitted: false, reason: 'pairing_without_system_context' });
  });

  it('admits a stated owner with a real thread', () => {
    expect(admitOwnerReport(report())).toEqual({ admitted: true });
  });
});

describe('one report licenses a report, not a fact', () => {
  it('makes the OWNER the subject of the sentence', () => {
    const s = ownerStatement(report({ claim: 'It sounded warm through my system.' }));
    expect(s).toMatch(/^One owner of the Thing reported on Reddit that/);
  });

  it('never states the product simply is something', () => {
    const s = ownerStatement(report());
    expect(s).not.toMatch(/^The Thing is|the Thing is warm/i);
  });

  it('carries the system when one was stated', () => {
    expect(ownerStatement(report({ associatedEquipment: ['Naim 250', 'Harbeth P3'] })))
      .toMatch(/in a system using Naim 250, Harbeth P3/);
  });

  it('flags a single-variable change, which is the strongest form', () => {
    expect(ownerStatement(report({ changedWithinSystem: true })))
      .toMatch(/changing only this component/);
  });
});

describe('frequency of anecdote is not objectivity', () => {
  const many = (n: number, thread = (i: number) => `https://reddit.com/t${i}`) =>
    Array.from({ length: n }, (_, i) => report({ author: `u${i}`, sourceUrl: thread(i) }));

  it('two owners are two owners, not a consensus', () => {
    expect(ownerConsensus('k', 'Thing', many(2))).toBeUndefined();
  });

  it('three posts by one person are one opinion', () => {
    const same = many(3).map((r) => ({ ...r, author: 'same-person' }));
    expect(ownerConsensus('k', 'Thing', same)).toBeUndefined();
  });

  it('three replies inside one thread are a conversation', () => {
    expect(ownerConsensus('k', 'Thing', many(3, () => 'https://reddit.com/one'))).toBeUndefined();
  });

  it('three independent authors across threads do signal', () => {
    const c = ownerConsensus('k', 'Thing', many(3));
    expect(c?.authors).toHaveLength(3);
  });

  it('and the signal says owners report, never that the product is', () => {
    const c = ownerConsensus('k', 'Thing', many(4));
    expect(c?.statement).toMatch(/owner-consensus signal/);
    expect(c?.statement).toMatch(/not a measurement and not a published review/);
    expect(c?.statement).toMatch(/partly evidence about the forum/);
  });
});

describe('pairing reports are the relational value', () => {
  it('a two-product report is a pairing report', () => {
    expect(isPairingReport(report({
      productKeys: ['a', 'b'], productNames: ['A', 'B'], associatedEquipment: ['Room'],
    }))).toBe(true);
    expect(isPairingReport(report())).toBe(false);
  });

  it('and it names both components it heard together', () => {
    const s = ownerStatement(report({
      productKeys: ['a', 'b'], productNames: ['Amp X', 'Speaker Y'],
      associatedEquipment: ['Some DAC'], claim: 'The combination was well balanced.',
    }));
    expect(s).toMatch(/Amp X and Speaker Y/);
  });
});
