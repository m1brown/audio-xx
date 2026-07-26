/**
 * Causal Phase 1 — before/after benchmark, end-to-end through the real
 * assessment pipeline. Also proves the safe-off invariant: flag off ⇒ no
 * causalBlock (payload byte-identical to pre-pilot).
 *
 * Run with: npx vitest run apps/web/src/lib/causal/__tests__/causal-benchmark-demo.test.ts
 */
import { describe, it, expect, vi } from 'vitest';

const BENCHMARK = 'Assess my system: Chord Hugo, Yamamoto A-08S, DeVore Orangutan O/96';

async function runWithFlag(value: string) {
  vi.resetModules();
  vi.stubEnv('NEXT_PUBLIC_CAUSAL_EXPLANATION', value);
  const { runArtifactPipeline } = await import('../../../product/assessment-pipeline');
  return runArtifactPipeline(BENCHMARK);
}

describe('Causal Phase 1 — before/after benchmark (end-to-end)', () => {
  it('BEFORE (flag off): assessment renders, no causal block', async () => {
    const r = await runWithFlag('');
    expect(r).toBeTruthy();
    const before = [r!.payload.recognition, ...r!.payload.caseParagraphs].join('\n\n');
    // eslint-disable-next-line no-console
    console.log('\n===== BEFORE (flag off) — current Evidence prose =====\n' + before + '\n');
    expect(r!.payload.causalBlock).toBeUndefined();
  });

  it('AFTER (flag on): the same system gains the "Why it sounds this way" block', async () => {
    const r = await runWithFlag('on');
    expect(r).toBeTruthy();
    // eslint-disable-next-line no-console
    console.log(
      '\n===== AFTER (flag on) — Why it sounds this way =====\n' + (r!.payload.causalBlock ?? '(none)') + '\n',
    );
    expect(r!.payload.causalBlock).toBe(
      'The Yamamoto A-08S is a single-ended-triode amplifier with limited output power. ' +
        'The DeVore Orangutan O/96 is catalogued as a high-efficiency loudspeaker and carries an ' +
        'authored manufacturer-basis effect specifically connecting it with SET amplification. ' +
        'Its greater acoustic output per available watt means the Yamamoto needs to use ' +
        'less of its limited power for a given listening level than it would with a ' +
        'substantially less sensitive loudspeaker. That preserves more headroom and reduces ' +
        'the likelihood of clipped or compressed peaks. With a less sensitive speaker, the ' +
        'same amplifier would have to use more of its available output to reach the same level.',
    );
  });

  it('SAFE-OFF: the non-causal parts of the payload are identical on and off', async () => {
    const off = await runWithFlag('');
    const on = await runWithFlag('on');
    const strip = (p: any) => {
      const { causalBlock, ...rest } = p;
      return JSON.stringify(rest);
    };
    expect(strip(on!.payload)).toBe(strip(off!.payload));
  });
});
