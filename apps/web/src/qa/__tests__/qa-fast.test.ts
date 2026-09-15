/**
 * QA harness — FAST suite (TIER 1 + deterministic TIER 2). BLOCKING.
 *
 * Runs the golden corpus through the real production entry points:
 * extraction identity, end-to-end kind/chain, deterministic composition over
 * declared evidence, drive-lane conclusions, ladder pins, and the metamorphic
 * mutation set. No model calls.
 *
 * Targeted P1 mode: QA_P1=<caseId> runs that case, its mutations, and its
 * declared `related` golden controls only.
 *
 *   node scripts/qa-harness.mjs fast
 *   node scripts/qa-harness.mjs p1 accuphase-trio
 */
import { describe, it, expect, afterAll } from 'vitest';
import { wattsAtStatedLoad } from '@/lib/artifact/interface-conclusions';
import { buildTurnContext } from '@/lib/turn-context';
import type { AudioSessionState } from '@/lib/system-types';
import { GOLDEN_CORPUS, caseById, TARGET_GROUPS } from '../harness/corpus';
import { observeCase, observeE2E } from '../harness/observe';
import { standardMutations, omittedBrandMutation } from '../harness/mutate';
import {
  evaluateIdentity, evaluateKind, evaluateEvidence, evaluateReasoning,
  evaluateSemantic, evaluateDrive, evaluateMutationStability,
} from '../harness/invariants';
import { formatFailures, summarize } from '../harness/report';
import type { Failure, GoldenCase } from '../harness/schema';

const TARGET = process.env.QA_P1;
const SELECTED: Set<string> | null = TARGET
  ? new Set(
    TARGET in TARGET_GROUPS
      ? TARGET_GROUPS[TARGET].flatMap((id) => [id, ...(caseById(id)?.related ?? [])])
      : [TARGET, ...(caseById(TARGET)?.related ?? [])],
  )
  : null;
const runs = (c: GoldenCase) => !SELECTED || SELECTED.has(c.id);

const allFails: Failure[] = [];
let mutationCount = 0;
let checkCount = 0;
const record = (fails: Failure[], checks: number) => {
  allFails.push(...fails);
  checkCount += checks;
  return fails;
};

describe('QA fast — golden corpus', () => {
  for (const c of GOLDEN_CORPUS) {
    if (!runs(c)) continue;

    describe(c.id, () => {
      it('base input: identity + end-to-end admission', () => {
        const o = observeCase(c, 'base', c.input, { e2e: true });
        const fails = [
          ...(c.skipIdentity ? [] : evaluateIdentity(c, o)),
          ...evaluateKind(c, o),
        ];
        expect(formatFailures(record(fails, 2))).toBe('');
      }, 90000);

      if (c.evidence !== undefined) {
        it('composed output: evidence, reasoning, semantics', () => {
          const o = observeCase(c, 'compose', c.input, { compose: true });
          const fails = [
            ...evaluateEvidence(c, o),
            ...evaluateReasoning(c, o),
            ...evaluateSemantic(c, o),
          ];
          expect(formatFailures(record(fails, 3))).toBe('');
        }, 90000);
      }

      if (c.drive) {
        it('drive lane holds its state', () => {
          expect(formatFailures(record(evaluateDrive(c), 1))).toBe('');
        });
      }

      if (c.ladder) {
        it('power ladder answers each load with its own wattage', () => {
          for (const [load, want] of Object.entries(c.ladder!.expect)) {
            expect(wattsAtStatedLoad(c.ladder!.value, Number(load))).toBe(want ?? undefined);
            checkCount += 1;
          }
        });
      }

      for (const m of c.landmarkMutations ?? []) {
        it(`landmark ${m.label}: set stable end-to-end`, () => {
          mutationCount += 1;
          const o = observeCase(c, m.label, m.input, { e2e: true });
          const fails = [
            ...(c.skipIdentity ? [] : evaluateMutationStability(c, o, m.lossy)),
            ...evaluateKind(c, o),
          ];
          expect(formatFailures(record(fails, 2))).toBe('');
        }, 90000);
      }

      if (c.parts && c.standardMutations) {
        const muts = [
          ...standardMutations(c.parts, { roleByPart: { 0: 'amplifier', 2: 'speaker' } }),
          ...(omittedBrandMutation(c.parts) ? [omittedBrandMutation(c.parts)!] : []),
        ];
        for (const m of muts) {
          it(`mutation ${m.label}: identity is frame-invariant`, () => {
            mutationCount += 1;
            // Lossy mutations may legitimately degrade — observe end-to-end
            // for those; non-lossy mutations are judged at extraction level.
            const o = observeCase(c, m.label, m.input, { e2e: !!m.lossy });
            const fails = evaluateMutationStability(c, o, m.lossy);
            expect(formatFailures(record(fails, 1))).toBe('');
          }, 90000);
        }
      }
    });
  }
});

describe('QA fast — saved/ad-hoc isolation', () => {
  const SAVED: AudioSessionState = {
    activeSystemRef: { kind: 'saved', id: 'sys-nathan-2' },
    savedSystems: [{
      id: 'sys-nathan-2', name: 'Nathan 2',
      components: [
        { brand: 'dCS', name: 'Rossini Apex', category: 'streamer_dac', role: 'dac' },
        { brand: 'ARC', name: 'ref 5', category: 'preamp', role: 'preamplifier' },
        { brand: 'Butler', name: 'Monads', category: 'power_amp', role: 'amplifier' },
        { brand: 'Acora', name: 'QRC-2', category: 'speaker', role: 'speaker' },
      ],
    }],
    draftSystem: null, loading: false, proposedSystem: null,
  } as unknown as AudioSessionState;

  it('an ad-hoc system stated inline supersedes the saved system for the turn', () => {
    const M = 'assess my system: Accuphase E-600, Accuphase DP-450 and Harbeth SHL5 Plus';
    const tc = buildTurnContext(M, SAVED, new Set(), undefined);
    const names = (tc.activeSystem?.components ?? [])
      .map((x) => `${x.brand} ${x.name}`.trim().toLowerCase());
    expect(names.some((n) => n.includes('e-600'))).toBe(true);
    expect(names.some((n) => n.includes('dp-450'))).toBe(true);
    for (const saved of ['butler', 'acora', 'rossini']) {
      expect(names.some((n) => n.includes(saved))).toBe(false);
    }
    checkCount += 1;
  }, 90000);

  it('a bare assessment request still resolves to the saved record (control)', () => {
    const tc = buildTurnContext('Assess my system', SAVED, new Set(), undefined);
    expect(tc.activeSystem?.components.length).toBe(4);
    checkCount += 1;
  }, 90000);

  it('the ad-hoc turn end-to-end does not leak saved components into the chain', () => {
    const M = 'assess my system: Accuphase E-600, Accuphase DP-450 and Harbeth SHL5 Plus';
    const e = observeE2E(M, SAVED);
    if (e.kind === 'assessment') {
      for (const saved of ['butler', 'acora', 'rossini']) {
        expect(e.chainNames.some((n) => n.includes(saved))).toBe(false);
      }
    } else {
      expect(['clarification', 'low_confidence']).toContain(e.kind);
    }
    checkCount += 1;
  }, 90000);
});

afterAll(() => {
  const cases = GOLDEN_CORPUS.filter(runs).length;
  const s = summarize(cases, mutationCount, checkCount, allFails);
  console.log(`[qa-harness] cases=${s.cases} mutations=${s.mutations} checks=${s.checks} `
    + `failures=${allFails.length} byLayer=${JSON.stringify(s.failuresByLayer)}`);
});
