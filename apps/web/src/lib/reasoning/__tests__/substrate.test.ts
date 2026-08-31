/**
 * Substrate Doctrine architectural regressions (2026-08-31).
 *
 * Pins the deterministic layer of the governed reasoning lane: identity
 * discipline, candidate-aware retrieval, computed facts, governed-context
 * serialization, and claim-repair mechanics. The model's conversational
 * behavior is proved by the rerunnable B++ battery (exp-bpp-run harness),
 * not by gate tests — these pins hold the substrate the model stands on.
 */
import { describe, it, expect } from 'vitest';
import { resolveCandidateIdentity, detectCandidates } from '../candidate-detection';
import { retrieveCandidateEvidence, retrieveEvidenceFor } from '../evidence-retrieval';
import { buildComputedFacts } from '../computed-facts';
import { serializeGovernedContext, REASONING_RULES } from '../governed-context';
import { applyClaimRepairs } from '../claim-validation';
import { REASONING_LANE_ENABLED } from '@/lib/feature-flags';

const NATHAN = [
  { displayName: 'dCS Rossini Apex', role: 'dac' },
  { displayName: 'ARC ref 5', role: 'preamplifier' },
  { displayName: 'Butler Monads', role: 'amplifier' },
  { displayName: 'Acora QRC-2', role: 'speaker' },
];
const NOW = 1_790_000_000_000;

describe('identity discipline — never substitute, always represent uncertainty', () => {
  it('a historical brand is never silently mapped to its successor (Bakoon→Enleum)', () => {
    const c = resolveCandidateIdentity('Bakoon AMP-13R');
    expect(c.displayName).toBe('Bakoon AMP-13R');
    expect(c.resolution).not.toBe('exact');
    expect(JSON.stringify(c)).not.toMatch(/enleum/i);
  });

  it('variants stay separate: CS600X resolves to CS600X, never CS600', () => {
    const c = resolveCandidateIdentity('Leben CS600X');
    expect(c.productKey).toBe('leben cs600x');
  });

  it('the exact CS600 resolves through the governed identity table', () => {
    const c = resolveCandidateIdentity('Leben CS600');
    expect(c.resolution).toBe('exact');
    expect(c.productKey).toBe('leben cs600');
  });

  it('a bare brand is ambiguous — which model is not established', () => {
    const c = resolveCandidateIdentity('Harbeths');
    expect(c.resolution).toBe('ambiguous');
    expect(c.identityNote).toMatch(/which exact model/i);
  });

  it('a fictional product is unknown, with the uncertainty represented', () => {
    const c = resolveCandidateIdentity('Fooblaster 9000');
    expect(c.resolution).not.toBe('exact');
  });

  it('detection recovers the listener\'s own words over a matcher rename', () => {
    const found = detectCandidates('What about a Bakoon AMP-13R instead of the Gaincard?', [
      { displayName: '47 Labs 4706 Gaincard' }, { displayName: 'Snell Type J' },
    ]);
    expect(found.some((c) => /bakoon/i.test(c.displayName))).toBe(true);
    expect(found.every((c) => !/enleum/i.test(c.displayName))).toBe(true);
  });

  it('a numeric model span survives a bare-brand matcher result (Hegel H590)', () => {
    const found = detectCandidates('What about a Hegel H590 instead?', NATHAN);
    expect(found.some((c) => c.displayName === 'Hegel H590')).toBe(true);
  });
});

describe('candidate-aware retrieval — evidence enters when the candidate does', () => {
  it('an ambiguous candidate retrieves NOTHING — no silent model choice', async () => {
    const ce = await retrieveCandidateEvidence(resolveCandidateIdentity('Harbeths'), { now: NOW });
    expect(ce.identity).toBe('ambiguous');
    expect(ce.items).toHaveLength(0);
    expect(ce.identityNote).toBeTruthy();
  });

  it('a catalog candidate carries price and tier as distinct catalog records', async () => {
    const ce = await retrieveCandidateEvidence(resolveCandidateIdentity('WiiM Amp'), { now: NOW });
    const txt = ce.items.map((i) => `${i.class}:${i.text}`).join('\n');
    expect(txt).toMatch(/catalog:current known retail price/);
    expect(txt).toMatch(/catalog:broad market tier/);
  });

  it('an evidence-less unknown stays unknown — absence is a finished state', async () => {
    const ce = await retrieveCandidateEvidence(resolveCandidateIdentity('Fooblaster 9000'), { now: NOW });
    expect(ce.items).toHaveLength(0);
    expect(ce.identity).not.toBe('exact');
  });

  it('independent listening items keep publication and condition', async () => {
    const ce = await retrieveEvidenceFor('Butler Monads', { resolution: 'exact', now: NOW });
    const obs = ce.items.filter((i) => i.class === 'independent_listening');
    expect(obs.length).toBeGreaterThan(0);
    expect(obs.some((i) => i.condition && /tube|preamplifier|driving/i.test(i.condition))).toBe(true);
  });
});

describe('computed facts — application computes, provenance travels', () => {
  it('the amplifier-substitution power delta computes with its resting figures', async () => {
    const facts = await buildComputedFacts({
      components: NATHAN,
      hypothetical: { candidate: 'Leben CS600', incumbent: 'Butler Monads' },
      now: NOW,
    });
    const delta = facts.find((f) => f.kind === 'power_delta');
    expect(delta).toBeTruthy();
    expect(delta!.statement).toMatch(/200W \(Butler Monads\)/);
    expect(delta!.statement).toMatch(/32W \(Leben CS600\)/);
    expect(delta!.restsOn.length).toBeGreaterThanOrEqual(2);
    expect(delta!.limitations).toMatch(/rated/i);
  });

  it('every computed fact is either established-with-figures or an explicit unknown', async () => {
    const facts = await buildComputedFacts({ components: NATHAN, now: NOW });
    for (const f of facts) {
      const isUnknown = /not established|is not published|could not be computed/i.test(`${f.statement} ${f.limitations}`);
      expect(isUnknown || f.restsOn.length > 0,
        `computed fact must carry its figures or record what is missing: ${f.statement.slice(0, 60)}`).toBe(true);
    }
  });
});

describe('governed context — provenance is never flattened', () => {
  it('serialization labels every class distinctly and keeps the one-slot hypothetical', () => {
    const text = serializeGovernedContext({
      activeSystem: { components: NATHAN, source: 'saved' },
      currentHypothetical: { candidate: 'Leben CS600', incumbent: 'Butler Monads' },
      candidates: [{
        displayName: 'Leben CS600', identity: 'exact',
        items: [
          { class: 'maker_published', text: 'power: 32W', sourceUrl: 'https://lebenhifi.com/x' },
          { class: 'independent_listening', text: 'clean, fog-free', publication: 'Stereophile', condition: 'at a show' },
          { class: 'third_party_reported', text: 'input impedance: 100k' },
        ],
      }],
      systemEvidence: [{ displayName: 'Butler Monads', identity: 'exact', items: [] }],
      computedFacts: [{ kind: 'power_delta', statement: 'changes from 200W to 32W', restsOn: ['a', 'b'] }],
      userObservations: ['I listen at moderate levels'],
    });
    expect(text).toContain('CURRENT HYPOTHETICAL: Leben CS600 replacing Butler Monads');
    expect(text).toContain('[MAKER-PUBLISHED]');
    expect(text).toContain('[INDEPENDENT LISTENING — Stereophile]');
    expect(text).toContain('; condition: at a show');
    expect(text).toContain('[THIRD-PARTY-REPORTED]');
    expect(text).toContain('[POWER_DELTA]');
    expect(text).toContain('rests on: a · b');
    expect(text).toMatch(/No licensed evidence held for this exact product/);
    expect(text).toContain('I listen at moderate levels');
  });

  it('the rules bind claims to evidence classes and permit inference', () => {
    expect(REASONING_RULES).toMatch(/never be stronger than its evidence class/i);
    expect(REASONING_RULES).toMatch(/facts → causes → conclusions/i);
    expect(REASONING_RULES).toMatch(/Change nothing/);
  });
});

describe('claim repair mechanics — weakening only, numbers guarded', () => {
  const CONTEXT = 'evidence: 32W amplifier, 200W incumbent';
  it('applies a weakened rewrite verbatim', () => {
    const r = applyClaimRepairs(
      'The Butler is known for organic warmth. It has 200W.',
      [{ type: 'unsupported_character', sentence: 'The Butler is known for organic warmth.', rewrite: 'The Butler has been described, under review conditions, as organic.' }],
      [CONTEXT],
    );
    expect(r.repaired).toBe(1);
    expect(r.text).toContain('under review conditions');
  });

  it('refuses a rewrite that introduces a figure from nowhere', () => {
    const r = applyClaimRepairs(
      'The amp is warm.',
      [{ type: 'mutated_spec', sentence: 'The amp is warm.', rewrite: 'The amp delivers 47W.' }],
      [CONTEXT],
    );
    expect(r.repaired).toBe(0);
    expect(r.text).toBe('The amp is warm.');
  });

  it('a sentence it cannot locate is reported but never rewritten', () => {
    const r = applyClaimRepairs('Plain text.',
      [{ type: 'unsupported_character', sentence: 'Different sentence.', rewrite: 'x' }], [CONTEXT]);
    expect(r.repaired).toBe(0);
    expect(r.text).toBe('Plain text.');
  });

  it('markdown emphasis does not block a repair', () => {
    const r = applyClaimRepairs(
      '**Hegel H20**: Known for its control and dynamics.',
      [{ type: 'unsupported_character', sentence: 'Hegel H20: Known for its control and dynamics.', rewrite: 'Hegel H20: no evidence is held for this product.' }],
      [CONTEXT],
    );
    expect(r.repaired).toBe(1);
    expect(r.text).toContain('no evidence is held');
  });

  it('removal (rewrite null) drops the sentence', () => {
    const r = applyClaimRepairs('Keep this. Drop this claim. Keep that.',
      [{ type: 'unsupported_character', sentence: 'Drop this claim.', rewrite: null }], [CONTEXT]);
    expect(r.repaired).toBe(1);
    expect(r.text).not.toContain('Drop this claim');
    expect(r.text).toContain('Keep this');
  });
});

describe('flag discipline — Wave 2 stays production behavior', () => {
  it('the reasoning lane is OFF by default', () => {
    expect(REASONING_LANE_ENABLED).toBe(false);
  });
});
