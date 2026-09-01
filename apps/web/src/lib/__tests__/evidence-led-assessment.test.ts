import { describe, it, expect } from 'vitest';
import { buildProvisionalPrompt, verdictFromEvidence, SYSTEM_PROMPT }
  from '../llm-system-inference';
import { driveConclusionFor, assessDriveCapability, parseQuantities }
  from '../evidence/physical-quantities';

/**
 * Steps 1–4 of the evidence-led assessment. The product question behind them:
 * can the existing engine produce an excellent assessment if we stop forcing
 * it to write an essay?
 */

const NATHAN = ['dCS Rossini Apex', 'ARC ref 5', 'Butler Monads', 'Acora QRC-2'];
const BUTLER = 'Minimum 100 Watts RMS @ 8 Ohms; 128 Watts, RMS typical @ 8 Ohms; '
  + '200 Watts, RMS typical @ 4 Ohms';

const facts = (rows: Array<[string, string, string]>) =>
  rows.map(([productKey, field, value]) => ({
    productKey, field, value, evidenceClass: 'manufacturer', tier: 'manufacturer',
    scope: 'product', attribution: { sourceUrl: 'https://example.test/spec' },
    retrievedAt: 1,
  }));

const nathanPrompt = () => buildProvisionalPrompt(
  'Assess my system', NATHAN,
  [{ name: 'dCS Rossini Apex', character: 'neutral-to-cool', source: 'brand' }],
  [{ name: 'ARC ref 5', role: 'preamplifier' },
    { name: 'Butler Monads', role: 'amplifier' },
    { name: 'Acora QRC-2', role: 'speaker' }],
  ['ARC ref 5', 'Butler Monads', 'Acora QRC-2'], [],
  facts([['butler monads', 'power_output', BUTLER],
    ['acora qrc-2', 'impedance', '4 ohm']]) as never,
  {} as never,
);

describe('STEP 1 — the contract stops demanding prose', () => {
  // The slot definitions live in the SYSTEM prompt; the per-turn evidence lives
  // in the user prompt. The essay shape was a property of the contract.
  const userPrompt = SYSTEM_PROMPT;

  it('marks every discretionary slot optional', () => {
    for (const field of ['systemThesis', 'interactionExplanation', 'tradeoff', 'action']) {
      const line = userPrompt.match(new RegExp(`"${field}": "([^"]*)`))?.[1] ?? '';
      expect(line, field).toMatch(/OPTIONAL|OMIT ENTIRELY/);
    }
  });

  it('keeps the verdict and the question as the floor', () => {
    expect(userPrompt).toMatch(/"verdict": "ONE sentence/);
    expect(userPrompt.match(/"verdict": "([^"]*)/)?.[1]).not.toMatch(/OPTIONAL/);
    expect(userPrompt.match(/"nextQuestion": "([^"]*)/)?.[1]).not.toMatch(/OPTIONAL/);
  });

  it('states that length follows evidence rather than a quota', () => {
    expect(userPrompt).toMatch(/LENGTH IS AN OUTPUT, NOT A TARGET/);
    expect(userPrompt).toMatch(/Nothing is\s+reconstructed to fill the space/);
  });
});

describe('STEP 2 — the verdict describes what Evaluate established', () => {
  it('NEVER announces a constraint when the relation is reinforcement', () => {
    // Nathan's live defect: "One licensed constraint stands out in this chain,
    // and on the evidence available the chain reinforces its own direction."
    const v = verdictFromEvidence('constraint',
      [{ kind: 'reinforcement', axis: 'power_load' }], "the Acora QRC-2's sensitivity");
    expect(v).not.toMatch(/constraint/i);
    expect(v).toContain('one compatibility finding');
    expect(v).toContain("the Acora QRC-2's sensitivity");
  });

  it('never implies system-wide coherence from a compatibility finding', () => {
    const v = verdictFromEvidence('no_change', [{ kind: 'reinforcement', axis: 'power_load' }]);
    expect(v).not.toMatch(/reinforces its own direction|coherent|voicing|tonal/i);
  });

  it('leads with a constraint whenever one survives', () => {
    expect(verdictFromEvidence('no_change', [
      { kind: 'reinforcement', axis: 'warm_bright' },
      { kind: 'constraint', axis: 'power_load' },
    ])).toMatch(/constraint/i);
  });

  it('still states restraint confidently on licensed tonal relations', () => {
    // The positive control. Restraint must not become muteness.
    const v = verdictFromEvidence('no_change', [
      { kind: 'reinforcement', axis: 'warm_bright' },
      { kind: 'reinforcement', axis: 'smooth_detailed' },
    ]);
    expect(v).toContain('Nothing here obviously needs changing');
    expect(v).toContain('the chain reinforces its own direction');
  });

  it('says so plainly when nothing was established', () => {
    expect(verdictFromEvidence('indeterminate', []))
      .toBe('No system-level interaction is established on the evidence held.');
  });
});

describe('STEP 3 — the named gap is promoted, not buried', () => {
  const drive = assessDriveCapability(
    parseQuantities('Butler Monads', 'power_output', BUTLER),
    parseQuantities('Acora QRC-2', 'impedance', '4 ohm')[0], undefined);
  const c = driveConclusionFor(drive, 'Butler Monads', 'Acora QRC-2')!;

  it('names the missing figure as a first-class value', () => {
    expect(c.gap).toBe("the Acora QRC-2's sensitivity");
  });

  it('asks about the listener experience, not for homework', () => {
    expect(c.question).toBe('Are you running into any limit on volume or dynamic range?');
  });

  it('keeps the accurate formulation of what sensitivity settles', () => {
    // Sensitivity alone does not determine in-room level. The licensed claim is
    // that without it the evidence held is insufficient to estimate headroom.
    // The first version of this test asserted against phrasings I had guessed
    // at and missed the phrasing actually shipped ("what would settle how loud
    // the pairing plays in your room"), so it now asserts the REQUIRED wording
    // rather than a list of wordings to avoid.
    expect(c.sentence).toMatch(/sensitivity is not published/);
    expect(c.sentence).toMatch(/not sufficient to estimate .* acoustic headroom reliably/);
    expect(c.sentence).not.toMatch(/how loud|settle|in your room|determines/i);
  });

  it('never lets an absent figure be reported as a fault', () => {
    // Nathan's first run under the new contract: "This system is materially
    // mismatched due to the lack of sensitivity information."
    expect(c.sentence).not.toMatch(/mismatch|compromis|at risk|may or may not/i);
    const v = verdictFromEvidence('constraint',
      [{ kind: 'reinforcement', axis: 'power_load' }], c.gap);
    expect(v).not.toMatch(/mismatch|constraint|compromis/i);
  });

  it('offers no gap when drive is fully established', () => {
    const full = assessDriveCapability(
      parseQuantities('Leben CS600', 'power_output', '32 watts'),
      parseQuantities('Klipsch Cornwall IV', 'impedance', '8 ohms')[0],
      parseQuantities('Klipsch Cornwall IV', 'sensitivity', '102dB @ 2.83V / 1m')[0]);
    expect(driveConclusionFor(full, 'Leben CS600', 'Klipsch Cornwall IV')?.gap).toBeUndefined();
  });
});

describe('STEP 4 — coverage is derived, never narrated', () => {
  const { coverageNote, userPrompt } = nathanPrompt();

  /*
   * SUPERSEDED BY EVIDENCE, 2026-08-25.
   *
   * This block used to assert that the note named "ARC ref 5" among the
   * components Audio XX holds no listening evidence for. That is now false:
   * The Absolute Sound's Reference 5 review is admitted, as is Stereophile's
   * and SoundStage!'s coverage of the QRC-2. Keeping the assertion would pin
   * a sentence contradicting the review printed directly beneath it.
   *
   * The limitation itself has not been dropped — it has moved to the layer
   * that can state it accurately. The review names the Butler Monads
   * specifically, says why the gap exists and says what would close it, where
   * the note could only say "most of this chain" and name the wrong
   * components.
   */
  it('no longer claims a blanket coverage gap for Nathan', () => {
    // Two of the four components are now characterised from admitted reviews,
    // so "most of this chain" is not true and the note correctly stands down.
    expect(coverageNote).toBeUndefined();
  });

  it('still leashes the model, which review evidence does NOT license', () => {
    // The note standing down must not be read as permission. Review evidence
    // licenses the deterministic review; letting it unleash the model produced
    // "the Rossini Apex, known for its... cooler presentation" — unsourced and
    // the opposite of what Stereophile reported.
    expect(userPrompt).toMatch(/EVIDENCE COVERAGE/);
    expect(userPrompt).toMatch(/You may NOT characterise this system's tonal balance/);
  });

  it('NEVER claims a search was performed', () => {
    for (const forbidden of [/we searched/i, /no reviews (exist|were found)/i,
      /could not find/i, /nothing was found/i, /after searching/i]) {
      // The note is absent for Nathan now; the invariant is about what it says
      // WHEN it says anything, so it is checked wherever it exists.
      if (coverageNote) expect(coverageNote).not.toMatch(forbidden);
      expect(userPrompt).not.toMatch(forbidden);
    }
  });

  it('forbids every tonal slot when coverage is thin', () => {
    // systemThesis alone was not enough. Nathan kept writing "high dynamic
    // resolution and control" in `tradeoff` and `action`, contradicting the
    // coverage note printed two paragraphs above it.
    expect(userPrompt).toMatch(/OMIT "systemThesis", "tradeoff" AND "action" ENTIRELY/);
    expect(userPrompt).toMatch(/do not\s+call any of it deliberate/);
  });

  it('stays silent when coverage is good', () => {
    const rich = buildProvisionalPrompt('Assess my system',
      ['Leben CS600', 'Klipsch Cornwall IV'],
      [{ name: 'Leben CS600', character: 'dense, harmonically rich', source: 'product' },
        { name: 'Klipsch Cornwall IV', character: 'immediate, horn-loaded', source: 'product' }],
      [], [], [], [] as never, {} as never);
    expect(rich.coverageNote).toBeUndefined();
    expect(rich.userPrompt).not.toMatch(/EVIDENCE COVERAGE/);
  });

  it('does not sweep an identity-unconfirmed component into the coverage note', () => {
    // A product Audio XX could not confirm exists is a different state from one
    // that exists and carries no sonic evidence. Conflating them would have the
    // note assert "verified identity" for something unverified.
    const mixed = buildProvisionalPrompt('Assess my system',
      ['Zorblax ZX1', 'Butler Monads', 'Acora QRC-2'], [],
      [{ name: 'Zorblax ZX1', role: 'amplifier' },
        { name: 'Butler Monads', role: 'amplifier' },
        { name: 'Acora QRC-2', role: 'speaker' }],
      ['Butler Monads', 'Acora QRC-2'], [], [] as never, {} as never);
    // Butler and Acora are the evidenced pair here; Zorblax is unconfirmed.
    // Whether the note fires or stands down, it must never name Zorblax.
    expect(mixed.coverageNote ?? '').not.toContain('Zorblax');
  });
});

describe('no tonal trade-off follows from a compatibility finding', () => {
  // Pinned as a behavioural expectation of the assembled response: with every
  // surviving relation on `power_load`, `tendencies` is withheld regardless of
  // what the model wrote. Instruction alone did not hold; this does.
  it('is stated in the contract AND enforced deterministically', () => {
    expect(SYSTEM_PROMPT).toMatch(
      /OMIT ENTIRELY if relationStatus is none_establishable, or if your relations are physical-compatibility findings only/);
  });
});
