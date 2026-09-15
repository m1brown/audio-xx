/**
 * QA harness — FULL suite. Runs only with QA_FULL=1.
 *
 * Adds to the fast tier:
 *   - end-to-end admission for EVERY standard mutation of the Accuphase
 *     landmark (fast checks mutations at extraction level; full drives the
 *     whole turn per frame);
 *   - the TIER 3 soft judge over captured live assessments (or, without
 *     captures, over the deterministic composed output). Judgments are
 *     OBSERVATIONAL: they are printed, never failed on.
 *
 *   node scripts/qa-harness.mjs full
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { caseById } from '../harness/corpus';
import { observeCase, observeCompose } from '../harness/observe';
import { standardMutations } from '../harness/mutate';
import { evaluateKind, evaluateMutationStability } from '../harness/invariants';
import { formatFailures } from '../harness/report';
import { judgeAssessment, formatSoftFinding } from '../harness/judge';

const FULL = process.env.QA_FULL === '1';
const CAPTURES_DIR = join(__dirname, '..', 'captures');

describe.runIf(FULL)('QA full — end-to-end frame admission (Accuphase landmark)', () => {
  const c = caseById('accuphase-trio')!;
  for (const m of standardMutations(c.parts!, { roleByPart: { 0: 'amplifier', 2: 'speaker' } })) {
    it(`e2e ${m.label}`, () => {
      const o = observeCase(c, m.label, m.input, { e2e: true });
      const fails = [
        ...evaluateMutationStability(c, o, m.lossy),
        ...evaluateKind(c, o),
      ];
      expect(formatFailures(fails)).toBe('');
    }, 90000);
  }
});

describe.runIf(FULL)('QA full — TIER 3 soft judge (observational)', () => {
  it('judges captured live assessments, or the composed fallback', async () => {
    const targets: Array<{ id: string; text: string; notes: string[] }> = [];
    if (existsSync(CAPTURES_DIR)) {
      for (const f of readdirSync(CAPTURES_DIR).filter((x) => x.endsWith('.txt'))) {
        const id = f.replace(/\.txt$/, '');
        const notes = caseById(id)?.soft ?? [];
        targets.push({ id, text: readFileSync(join(CAPTURES_DIR, f), 'utf8'), notes });
      }
    }
    if (targets.length === 0) {
      const c = caseById('accuphase-trio')!;
      targets.push({ id: c.id, text: observeCompose(c), notes: c.soft ?? [] });
    }
    let calls = 0;
    for (const t of targets) {
      const r = await judgeAssessment(t.text, t.notes);
      if ('skipped' in r) {
        console.log(`[qa-soft] ${t.id}: SKIPPED — ${r.skipped}`);
        continue;
      }
      calls += r.modelCalls;
      for (const j of r.judgments) {
        const flag = ['YES', 'NOT_APPLICABLE', 'NO_QUESTION'].includes(j.verdict)
          && j.question !== 'CLAIM_CONTRADICTION'
          ? 'ok ' : (j.question === 'CLAIM_CONTRADICTION' && j.verdict === 'NO' ? 'ok ' : 'FLAG');
        console.log(`[qa-soft] ${t.id} ${flag} ${j.question}=${j.verdict}`);
        if (flag === 'FLAG') console.log(formatSoftFinding(t.id, j));
      }
    }
    console.log(`[qa-soft] model calls: ${calls}`);
    // Observational: the test asserts only that the judge infrastructure ran.
    expect(true).toBe(true);
  }, 300000);
});

describe.runIf(!FULL)('QA full (skipped)', () => {
  it('set QA_FULL=1 to run the full tier', () => {
    expect(true).toBe(true);
  });
});
