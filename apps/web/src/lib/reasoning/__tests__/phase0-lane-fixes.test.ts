/**
 * vNext Phase 0 — lane fixes pinned (audit findings, 2026-09-15).
 *
 * Both fixes live in flag-off lane code; production behavior at 1498b17 is
 * unchanged. Pinned so the experiment's substrate semantics stay stable.
 */
import { describe, it, expect } from 'vitest';
import { deriveHypothetical } from '../context-assembly';
import { buildComputedFacts } from '../computed-facts';

const COMPONENTS = [
  { displayName: 'Accuphase E-600', role: 'amplifier' },
  { displayName: 'Accuphase DP-450', role: 'cd player' },
  { displayName: 'Harbeth SHL5 Plus', role: 'speaker' },
];

describe('deriveHypothetical — "forget" clears the slot', () => {
  const slot = { candidate: 'Hegel H390', incumbent: 'Accuphase E-600' };

  it('forgetting the candidate by name clears it', () => {
    expect(deriveHypothetical(
      'Actually forget the Hegel. Would changing the DAC side matter more?',
      COMPONENTS, slot,
    )).toBeNull();
  });

  it('"forget it" with a live slot clears it', () => {
    expect(deriveHypothetical('Forget it — what else could I try?', COMPONENTS, slot)).toBeNull();
  });

  it('"never mind that" with a live slot clears it', () => {
    expect(deriveHypothetical(
      'Never mind that — is there anything actually wrong with what I have?',
      COMPONENTS, slot,
    )).toBeNull();
  });

  it('forgetting something unrelated carries the slot forward', () => {
    expect(deriveHypothetical(
      'I forget the model number of my old turntable — anyway, how is the pairing?',
      COMPONENTS, slot,
    )).toEqual(slot);
  });

  it('no slot: "forget" phrasing stays a no-op', () => {
    expect(deriveHypothetical('Forget it.', COMPONENTS, null)).toBeNull();
  });
});

describe('deriveHypothetical — past-tense substitution phrasing sets the slot', () => {
  it('"What if I replaced the Accuphase with a Hegel H390?" sets it', () => {
    const slot = deriveHypothetical(
      'What if I replaced the Accuphase with a Hegel H390?', COMPONENTS, null,
    );
    expect(slot?.candidate).toMatch(/hegel/i);
    expect(slot?.incumbent).toMatch(/accuphase/i);
  });
});

describe('computed facts — power delta only for amplification substitutions', () => {
  it('a non-amplification incumbent yields no power_delta fact', async () => {
    const facts = await buildComputedFacts({
      components: COMPONENTS,
      hypothetical: { candidate: 'Chord Qutest', incumbent: 'Accuphase DP-450' },
    });
    expect(facts.some((f) => f.kind === 'power_delta')).toBe(false);
  });
});
