/**
 * Graph-construction integrity for the assessment artifact's component credit
 * (Beta Bug Sweep R1).
 *
 * Root cause fixed: synthesizeArtifact built the component credit by
 * index-zipping the authoritative, role-sorted `systemChain.names` against the
 * raw, user-ordered `systemChain.fullChain` and, via a "foreign brand token"
 * guard, substituting a mis-indexed raw segment. When the two lists diverged in
 * order or length, that leaked a leading question preamble or a raw misspelling
 * into the credit, dropped the correct component, or read as a duplicate.
 *
 * These are the two reviewed S1 cases (UP-04, EC-03) plus the general
 * invariants the class violated. Credit now renders directly from `names`.
 */
import { describe, it, expect } from 'vitest';
import { runArtifactPipeline } from '../../../product/assessment-pipeline';

/** Normalized token set of a display name, minus trivial tokens. */
function tokens(name: string): Set<string> {
  return new Set(
    name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter((t) => t.length >= 2),
  );
}

/** True if any credit entry's token set is a subset of another's (same unit twice). */
function hasTokenSubsetDuplicate(credit: string[]): boolean {
  const toks = credit.map(tokens);
  for (let i = 0; i < toks.length; i++) {
    for (let j = i + 1; j < toks.length; j++) {
      const a = toks[i], b = toks[j];
      if (a.size === 0 || b.size === 0) continue;
      const [small, big] = a.size <= b.size ? [a, b] : [b, a];
      if ([...small].every((t) => big.has(t))) return true;
    }
  }
  return false;
}

const INTERROGATIVE = /\b(should|what|where|which|worth|keep|upgrade|thoughts)\b|\?/i;

describe('R1 — assessment credit renders the clean component graph, not raw input', () => {
  it('UP-04: a leading question does not leak into the credit, and the DAC is not duplicated', () => {
    const r = runArtifactPipeline('Should I just keep what I have? Denafrips Ares II, Rega Brio, Wharfedale Linton.');
    expect(r).toBeTruthy();
    const credit = r!.payload.componentCredit;
    // No credit entry carries the question preamble.
    for (const c of credit) expect(c).not.toMatch(INTERROGATIVE);
    // The DAC surfaces once, not as "Denafrips Ares II" AND "Ares Ii".
    expect(hasTokenSubsetDuplicate(credit)).toBe(false);
    // Three components in, three credited.
    expect(credit.length).toBe(3);
    // The prose that consumes the credit is equally clean.
    const body = r!.payload.caseParagraphs.join('\n');
    expect(body).not.toMatch(/should i just keep/i);
  });

  it('EC-03: a misspelled input does not duplicate the amp or drop the speaker', () => {
    const r = runArtifactPipeline('assess my system: harbeth schl5+, hegal h190');
    expect(r).toBeTruthy();
    const credit = r!.payload.componentCredit;
    // The raw misspelling never reaches the credit.
    for (const c of credit) expect(c.toLowerCase()).not.toContain('hegal');
    // No duplicate of the amp.
    expect(hasTokenSubsetDuplicate(credit)).toBe(false);
    // The speaker is present, not silently dropped.
    expect(credit.some((c) => /harbeth/i.test(c))).toBe(true);
    const body = r!.payload.caseParagraphs.join('\n').toLowerCase();
    expect(body).not.toContain('hegal');
  });

  it('invariant: coherent reference systems credit each component once, no preamble', () => {
    const systems = [
      'Assess my system: Harbeth SHL5+, Hegel H190, Bluesound Node',
      'Assess my system: Denafrips Pontus II, Leben CS600X, DeVore O/96',
      'Assess my system: Klipsch Cornwall IV, Decware SE84UFO',
    ];
    for (const s of systems) {
      const r = runArtifactPipeline(s);
      expect(r, s).toBeTruthy();
      const credit = r!.payload.componentCredit;
      expect(hasTokenSubsetDuplicate(credit), `duplicate credit for: ${s}`).toBe(false);
      for (const c of credit) expect(c, `preamble leaked for: ${s}`).not.toMatch(/\?|\bassess\b/i);
    }
  });
});
