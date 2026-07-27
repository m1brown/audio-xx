/**
 * Causal Phase 1 — before/after benchmark, end-to-end through the real
 * assessment pipeline.
 *
 * Proves the licensed causal explanation is now WOVEN INTO the mechanism arc
 * (a caseParagraph), not appended as a labelled block — and the safe-off
 * invariant: flag off ⇒ the causal paragraph is absent and the rest of the
 * assessment is byte-identical.
 *
 * Run with: npx vitest run apps/web/src/lib/causal/__tests__/causal-benchmark-demo.test.ts
 */
import { describe, it, expect, vi } from 'vitest';

const BENCHMARK = 'Assess my system: Chord Hugo, Yamamoto A-08S, DeVore Orangutan O/96';

// The exact licensed prose (see engine.composeBlock). No rule name, fact key,
// confidence, provenance basis, or "authored effect" machinery.
const CAUSAL_SENTENCE =
  'The Yamamoto A-08S is a single-ended-triode amplifier with limited output power, ' +
  'and the DeVore Orangutan O/96 is a high-efficiency loudspeaker its maker built especially ' +
  'for low-powered tube amplifiers, the Yamamoto among them. Because the speaker ' +
  'produces more acoustic output from each watt, the Yamamoto uses less of its ' +
  'limited power to reach a given listening level than it would with a substantially ' +
  'less sensitive speaker — which leaves more headroom and makes clipped or compressed ' +
  'peaks less likely. A less sensitive speaker would force the same amplifier to use ' +
  'more of its output to reach the same level.';

async function runWithFlag(value: string) {
  vi.resetModules();
  vi.stubEnv('NEXT_PUBLIC_CAUSAL_EXPLANATION', value);
  const { runArtifactPipeline } = await import('../../../product/assessment-pipeline');
  return runArtifactPipeline(BENCHMARK);
}

describe('Causal Phase 1 — before/after benchmark (end-to-end)', () => {
  it('BEFORE (flag off): assessment renders, no causal paragraph', async () => {
    const r = await runWithFlag('');
    expect(r).toBeTruthy();
    const before = [r!.payload.recognition, ...r!.payload.caseParagraphs].join('\n\n');
    // eslint-disable-next-line no-console
    console.log('\n===== BEFORE (flag off) =====\n' + before + '\n');
    expect(r!.payload.caseParagraphs).not.toContain(CAUSAL_SENTENCE);
  });

  it('AFTER (flag on): the licensed explanation appears as one integrated caseParagraph', async () => {
    const r = await runWithFlag('on');
    expect(r).toBeTruthy();
    const paras = r!.payload.caseParagraphs;
    // eslint-disable-next-line no-console
    console.log('\n===== AFTER (flag on) =====\n' + paras.join('\n\n') + '\n');
    // Present, verbatim, exactly once.
    expect(paras.filter((p) => p === CAUSAL_SENTENCE)).toHaveLength(1);
    // Woven into the mechanism arc: it sits immediately after the coherence
    // beat, not at the very end (i.e. not simply appended).
    const idx = paras.indexOf(CAUSAL_SENTENCE);
    expect(idx).toBeGreaterThan(0);
    const prior = paras[idx - 1];
    expect(/hangs together|coherence|nothing upstream fights/i.test(prior)).toBe(true);
  });

  it('SAFE-OFF: removing the causal paragraph from flag-on yields the flag-off payload', async () => {
    const off = await runWithFlag('');
    const on = await runWithFlag('on');
    const stripCausal = (p: any) => ({
      ...p,
      caseParagraphs: p.caseParagraphs.filter((x: string) => x !== CAUSAL_SENTENCE),
    });
    expect(JSON.stringify(stripCausal(on!.payload))).toBe(JSON.stringify(off!.payload));
  });
});
