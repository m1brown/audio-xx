/**
 * QA harness — historical failure proof. BLOCKING (proves detector coverage).
 *
 * Every real failure class Audio XX has shipped (or nearly shipped) is
 * replayed here as an intentionally bad CONSTRUCTED observation — no old
 * product code is resurrected. Each proof shows:
 *
 *   HISTORICAL CLASS → INVARIANT → EXPECTED FAIL SIGNAL
 *
 * Production passes the repaired forms in qa-fast; this file proves the
 * harness would have caught each defect had it existed at the time.
 */
import { describe, it, expect } from 'vitest';
import { caseById } from '../harness/corpus';
import {
  evaluateIdentity, evaluateKind, evaluateEvidence, evaluateReasoning,
  evaluateSemantic, evaluateMutationStability,
} from '../harness/invariants';
import type { GoldenCase, Observation } from '../harness/schema';

function obs(caseId: string, partial: Partial<Observation>): Observation {
  return {
    caseId, mutation: partial.mutation ?? 'historical', input: partial.input ?? '',
    identities: [], categories: [], ...partial,
  };
}
const invariants = (fails: Array<{ invariant: string }>) => fails.map((f) => f.invariant.split(' ')[0]);

describe('historical failure proof — 11 classes', () => {
  it('1 · A35 → phantom Topping A3 (identity collision) → I-PHANTOM', () => {
    const c = caseById('nad-vintage')!;
    const o = obs(c.id, {
      input: c.input,
      identities: ['dynaco a35', 'nad av716', 'topping a3', 'topping d70 pro octo'],
      categories: ['speaker', 'integrated', 'amplifier', 'dac'],
    });
    const inv = invariants(evaluateIdentity(c, o));
    expect(inv).toContain('I-PHANTOM');
    expect(inv).toContain('I-COUNT');
  });

  it('2 · missing Accuphase DP-450 same-brand sibling → I-SET', () => {
    const c = caseById('accuphase-trio')!;
    const o = obs(c.id, {
      input: c.input,
      identities: ['accuphase e-600', 'harbeth shl5 plus'],
      categories: ['amplifier', 'speaker'],
    });
    const inv = invariants(evaluateIdentity(c, o));
    expect(inv).toContain('I-SET');
    expect(inv).toContain('I-COUNT');
  });

  it('3 · 30W@8Ω relabelled as 30W@6Ω → E-LOAD-PROVENANCE', () => {
    const c = caseById('accuphase-trio')!;
    const o = obs(c.id, {
      input: c.input,
      composedText: 'Published figures put the Accuphase E-600 at 30 watts into 6 ohms, '
        + 'the load the Harbeth presents.',
      evidence: c.evidence,
    });
    expect(invariants(evaluateEvidence(c, o))).toContain('E-LOAD-PROVENANCE');
  });

  it('4 · "amply powered" beside "genuinely power-constrained" → R-EXCLUSIVE', () => {
    const c = caseById('accuphase-trio')!;
    const o = obs(c.id, {
      composedText: 'The system is amply powered for any realistic level. '
        + 'This pairing is genuinely power-constrained — a live constraint.',
    });
    expect(invariants(evaluateReasoning(c, o))).toContain('R-EXCLUSIVE');
  });

  it('5 · saved-system contamination (WLM Diva inside an ad-hoc Accuphase turn) → I-ORIGIN', () => {
    const c = caseById('accuphase-trio')!;
    const o = obs(c.id, {
      input: c.input,
      identities: ['accuphase dp-450', 'accuphase e-600', 'harbeth shl5 plus', 'wlm diva'],
      categories: ['other', 'amplifier', 'speaker', 'speaker'],
    });
    const inv = invariants(evaluateIdentity(c, o));
    expect(inv).toContain('I-ORIGIN');
    expect(inv).toContain('I-COUNT');
  });

  it('6 · JOB/Boenicke one-sided relationship falsely resolved → N-falsely-resolved', () => {
    const c = caseById('job-boenicke')!;
    const o = obs(c.id, {
      composedText: 'With the W5 on record, the Job integrated leaves it amply powered.',
    });
    const inv = evaluateSemantic(c, o).map((f) => f.invariant);
    expect(inv).toContain('N-falsely-resolved-generous');
  });

  it('7 · Decware/Magnepan established mismatch weakened → R-STATE', () => {
    const base = caseById('decware-magnepan')!;
    // The mismatch is the case's semantic ground truth; a weakened output
    // (no constrained state, a no-obvious-problem verdict instead) must fail
    // the expected-state invariant.
    const weakenedContract: GoldenCase = { ...base, headroom: 'constrained', evidence: [] };
    const o = obs(base.id, {
      composedText: 'Published figures put this pairing at no obvious mismatch — '
        + 'nothing here needs changing.',
    });
    const inv = invariants(evaluateReasoning(weakenedContract, o));
    expect(inv).toContain('R-STATE');
  });

  it('8 · empty-evidence sonic/synergy assertion → E-SONIC-LICENCE', () => {
    const c = caseById('fictional-unknown')!;
    const o = obs(c.id, {
      composedText: 'Together these lean towards a detailed, slightly bright balance '
        + 'with genuine synergy between amplifier and speakers.',
      evidence: [],
    });
    expect(invariants(evaluateEvidence(c, o))).toContain('E-SONIC-LICENCE');
  });

  it('9 · frame-dependent ingestion (copula frame lost the DP-450) → I-SET via mutation stability', () => {
    const c = caseById('accuphase-trio')!;
    const o = obs(c.id, {
      mutation: 'frame_ownership_copula',
      input: 'my system is Accuphase E-600, Accuphase DP-450 and Harbeth SHL5 Plus',
      identities: ['accuphase e-600', 'harbeth shl5 plus'],
      categories: ['amplifier', 'speaker'],
    });
    const inv = invariants(evaluateMutationStability(c, o, false));
    expect(inv).toContain('I-SET');
  });

  it('10 · follow-on discourse flipped assessment to wrong-premise clarification → K-KIND', () => {
    const c = caseById('followon-discourse')!;
    const o = obs(c.id, {
      input: c.input,
      identities: ['harbeth shl5 plus', 'naim supernait 3'],
      categories: ['speaker', 'amplifier'],
      kind: 'clarification',
    });
    expect(invariants(evaluateKind(c, o))).toContain('K-KIND');
  });

  it('11 · room/listener prose became a phantom component → I-COUNT (+ chain phantom)', () => {
    const c = caseById('followon-discourse')!;
    const o = obs(c.id, {
      input: 'assess my system: Naim SuperNait 3, Harbeth SHL5 Plus; my room is about 20 square metres',
      identities: ['harbeth shl5 plus', 'naim supernait 3', 'room is about 20 square metres'],
      categories: ['speaker', 'amplifier', 'other'],
      kind: 'assessment',
      chainNames: ['naim supernait 3', 'harbeth shl5 plus', 'room is about 20 square metres'],
    });
    const inv = invariants(evaluateIdentity(c, o));
    expect(inv).toContain('I-COUNT');
  });
});

describe('field hygiene — the E-QUANT-CLEAN diagnostic catches the observed shape', () => {
  it('the calculation layer consumes only the numeric quantity (P2, not P1)', async () => {
    // The observed production value "6 ohms, easy to drive" mixes a datum
    // with maker load characterization. parseQuantities extracts the numeric
    // 6Ω, so ARITHMETIC is uncontaminated — the descriptor leaks only into
    // rendered prose. That bounds the finding to KNOWN P2 (data-label
    // cleanliness), not a live P1.
    const { parseQuantities } = await import('@/lib/evidence/physical-quantities');
    const q = parseQuantities('Harbeth SHL5 Plus', 'nominal_impedance', '6 ohms, easy to drive')[0];
    expect(q?.value).toBe(6);
    expect(q?.unit).toBe('Ω');
  });

  it('"6 ohms, easy to drive" inside a quantitative field is flagged', () => {
    const c = caseById('accuphase-trio')!;
    const o = obs(c.id, {
      composedText: 'x',
      evidence: [
        { component: 'Harbeth SHL5 Plus', label: 'nominal impedance', value: '6 ohms, easy to drive' },
      ],
    });
    expect(invariants(evaluateEvidence(c, o))).toContain('E-QUANT-CLEAN');
  });
});
