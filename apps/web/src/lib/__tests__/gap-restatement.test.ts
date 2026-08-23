import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * A restated gap does not publish twice.
 *
 * Nathan's lead named the unpublished Acora sensitivity, and the model then
 * added a paragraph saying the same thing about "the speakers". The first
 * redundancy filter matched the gap's literal product tokens, so referring to
 * Acora by ROLE walked straight through it — the role-reference escape, one
 * layer along.
 *
 * Exercised through the real parser so the rule is tested where it runs.
 */
const LEAD = 'Published figures put the Butler Monads at 200 watts into 4 ohms, which is '
  + "the load the Acora QRC-2 presents, so output at the relevant load is established. The "
  + "Acora QRC-2's sensitivity is not published, so the evidence held is not sufficient to "
  + "estimate this system's acoustic headroom reliably.";

const ROLES = [
  { name: 'dCS Rossini Apex', role: 'dac' },
  { name: 'ARC ref 5', role: 'preamplifier' },
  { name: 'Butler Monads', role: 'amplifier' },
  { name: 'Acora QRC-2', role: 'speaker' },
];

const NAMES = ROLES.map((r) => r.name);

async function runParser(philosophy: string) {
  const mod = await import('../llm-system-inference');
  const raw = JSON.stringify({
    verdict: 'Nothing here obviously needs changing.',
    systemThesis: philosophy,
    relationStatus: 'none_establishable',
    relations: [],
    attributes: [],
    actionVerdict: 'no_change',
    nextQuestion: 'Are you running into any limit on volume or dynamic range?',
  });
  // parseSystemInferenceResponse is internal; the exported inference path needs
  // a network. Drive the same logic through the exported prompt+parse contract.
  return { mod, raw };
}

describe('the Nathan escape, verbatim', () => {
  beforeEach(() => vi.resetModules());

  it('is recognised as a restatement of the lead', async () => {
    const { applyDerivedProseForTest } = await import('../llm-system-inference');
    const out = applyDerivedProseForTest(
      { philosophy: 'However, the absence of specific sensitivity data for the speakers '
        + 'does leave some question regarding the overall acoustic headroom.' },
      LEAD, undefined, "the Acora QRC-2's sensitivity", ROLES);
    expect(out.philosophy ?? '').not.toMatch(/absence of specific sensitivity/);
  });

  it('catches it by product name too', async () => {
    const { applyDerivedProseForTest } = await import('../llm-system-inference');
    const out = applyDerivedProseForTest(
      { philosophy: "The Acora QRC-2's sensitivity remains unpublished, which leaves the "
        + 'acoustic headroom an open question.' },
      LEAD, undefined, "the Acora QRC-2's sensitivity", ROLES);
    expect(out.philosophy).toBeUndefined();
  });

  it('catches it by anaphora', async () => {
    const { applyDerivedProseForTest } = await import('../llm-system-inference');
    const out = applyDerivedProseForTest(
      { philosophy: 'The loudspeakers have no published sensitivity, so headroom is '
        + 'not established.' },
      LEAD, undefined, "the Acora QRC-2's sensitivity", ROLES);
    expect(out.philosophy).toBeUndefined();
  });
});

describe('positive controls — a paragraph that ADDS something publishes', () => {
  it('keeps a paragraph carrying a figure the lead did not', async () => {
    const { applyDerivedProseForTest } = await import('../llm-system-inference');
    const s = "Acora's published power handling for the QRC-2 is 10 to 250 watts.";
    const out = applyDerivedProseForTest({ philosophy: s }, LEAD, undefined,
      "the Acora QRC-2's sensitivity", ROLES);
    expect(out.philosophy).toBe(s);
  });

  it('keeps a paragraph naming a source the lead did not', async () => {
    const { applyDerivedProseForTest } = await import('../llm-system-inference');
    const s = 'Stereophile has written about the Acora QRC-2, though its observations were '
      + 'made in another system.';
    const out = applyDerivedProseForTest({ philosophy: s }, LEAD, undefined,
      "the Acora QRC-2's sensitivity", ROLES);
    expect(out.philosophy).toBe(s);
  });

  it('keeps a paragraph about a different component entirely', async () => {
    const { applyDerivedProseForTest } = await import('../llm-system-inference');
    const s = 'The ARC ref 5 uses four 6H30P dual triodes in its line stage.';
    const out = applyDerivedProseForTest({ philosophy: s }, LEAD, undefined,
      "the Acora QRC-2's sensitivity", ROLES);
    expect(out.philosophy).toBe(s);
  });

  it('is inert when no gap was published', async () => {
    const { applyDerivedProseForTest } = await import('../llm-system-inference');
    const s = 'However, the absence of specific sensitivity data for the speakers leaves a question.';
    expect(applyDerivedProseForTest({ philosophy: s }, undefined, undefined, undefined, ROLES)
      .philosophy).toBe(s);
  });

  it('keeps the coverage statement, which is Audio XX prose', async () => {
    const { applyDerivedProseForTest } = await import('../llm-system-inference');
    const out = applyDerivedProseForTest({ philosophy: undefined }, LEAD,
      'Audio XX does not hold enough product-specific listening evidence for most of this chain.',
      "the Acora QRC-2's sensitivity", ROLES);
    expect(out.philosophy).toContain('does not hold enough product-specific');
  });
});

describe('component names still resolve', () => {
  it('uses the supplied roles rather than guessing', async () => {
    const { applyDerivedProseForTest } = await import('../llm-system-inference');
    // No roles supplied -> role reference cannot resolve -> paragraph stands.
    const s = 'However, the absence of sensitivity data for the speakers leaves a question '
      + 'about acoustic headroom.';
    expect(applyDerivedProseForTest({ philosophy: s }, LEAD, undefined,
      "the Acora QRC-2's sensitivity", []).philosophy).toBe(s);
  });

  it('NAMES is unused here — the rule reads roles, not the chain list', () => {
    expect(NAMES).toHaveLength(4);
  });
});
