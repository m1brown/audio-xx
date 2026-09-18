/**
 * Golden System Conversations — TIER A (deterministic; runs in the
 * standard gate on every commit; zero model calls).
 *
 * Three jobs:
 *  1. CORPUS INTEGRITY — the four archetypes, scenario shapes, paraphrase
 *     variants, observation pairs, and historical artifacts stay complete.
 *  2. INVARIANT WIRING — the Layer-1 deterministic invariants this corpus
 *     relies on are enforced by real, present lock tests. The corpus
 *     documents them; the pins own them. If a pin file disappears or loses
 *     its key content, this test fails before the corpus silently
 *     references dead machinery.
 *  3. HYPOTHETICAL SLOT MORPHOLOGY — the §7 phrasings arm/clear the
 *     one-slot hypothetical deterministically, including the KNOWN P3
 *     ("traded X for Y" does not arm the slot). Asserting the known miss
 *     keeps it measured: a future fix flips this test consciously.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { GOLDEN_ARCHETYPES, GOLDEN_SYSTEM_IDS } from '../archetypes';
import { GOLDEN_SCENARIOS, OBSERVATION_PAIRS, turnText, type TurnSlot } from '../scenarios';
import { EXPERIMENT_SYSTEMS } from '../../vnext/frozen-evidence';
import { assembleGovernedContext } from '@/lib/reasoning/context-assembly';

const GOLDEN_DIR = join(__dirname, '..');
const WEB_SRC = join(__dirname, '..', '..', '..');

describe('corpus integrity', () => {
  it('exactly the four acceptance archetypes, each with a harness system', () => {
    expect(GOLDEN_SYSTEM_IDS.sort()).toEqual(['accuphase', 'france-ii', 'nad', 'nathan']);
    for (const a of GOLDEN_ARCHETYPES) {
      const sys = EXPERIMENT_SYSTEMS.find((s) => s.id === a.systemId);
      expect(sys, `${a.systemId} must exist in frozen-evidence EXPERIMENT_SYSTEMS`).toBeDefined();
      expect(a.stresses.length).toBeGreaterThanOrEqual(4);
      expect(a.acceptedBehaviors.length).toBeGreaterThanOrEqual(4);
      expect(a.watchFor.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('every scenario covers the canonical shape', () => {
    const required: TurnSlot[] = [
      'assessment', 'strongest', 'limiting', 'amp_relationship',
      'hypothetical', 'hypo_discussion', 'return_actual',
      'observation', 'candidates', 'leave_alone',
    ];
    expect(GOLDEN_SCENARIOS.map((s) => s.systemId).sort()).toEqual([...GOLDEN_SYSTEM_IDS].sort());
    for (const s of GOLDEN_SCENARIOS) {
      const slots = s.turns.map((t) => t.slot);
      for (const r of required) {
        expect(slots, `${s.systemId} must include slot ${r}`).toContain(r);
      }
      expect(slots[0]).toBe('assessment');
      expect(slots.at(-1)).toBe('leave_alone');
      // Hypothetical exploration must return to the actual system.
      expect(slots.indexOf('return_actual')).toBeGreaterThan(slots.indexOf('hypothetical'));
      // At least one listener-stated fact flows into userObservations.
      expect(s.turns.filter((t) => t.observation).length).toBeGreaterThanOrEqual(1);
    }
  });

  it('key turns carry paraphrase variants so semantics, not routing memory, is measured', () => {
    for (const s of GOLDEN_SCENARIOS) {
      for (const slot of ['hypothetical', 'observation', 'candidates', 'leave_alone'] as TurnSlot[]) {
        const turn = s.turns.find((t) => t.slot === slot)!;
        expect(turn.variants.length, `${s.systemId}/${slot} needs ≥2 variants`).toBeGreaterThanOrEqual(2);
        expect(turnText(turn, 0)).not.toBe(turnText(turn, 1));
        expect(turnText(turn, turn.variants.length)).toBe(turnText(turn, 0));
      }
    }
  });

  it('scenarios are four listeners, not one template', () => {
    for (const slot of ['limiting', 'candidates', 'leave_alone'] as TurnSlot[]) {
      const first = GOLDEN_SCENARIOS.map((s) => s.turns.find((t) => t.slot === slot)!.variants[0]);
      expect(new Set(first).size, `slot ${slot} wording must differ across systems`).toBe(first.length);
    }
  });

  it('observation pairs exist for all four systems and share the decision question', () => {
    expect(OBSERVATION_PAIRS.map((p) => p.systemId).sort()).toEqual([...GOLDEN_SYSTEM_IDS].sort());
    for (const p of OBSERVATION_PAIRS) {
      expect(p.transformed.endsWith(p.baseline)).toBe(true);
      expect(p.transformed.length).toBeGreaterThan(p.baseline.length + 20);
    }
  });

  it('historical artifacts are present and complete', () => {
    const md = readFileSync(join(GOLDEN_DIR, 'historical', 'acceptance-transcripts.md'), 'utf8');
    for (const section of ['SYSTEM A — FRANCE II', 'SYSTEM B — NATHAN', 'SYSTEM C — NAD', 'SYSTEM D — ACCUPHASE']) {
      expect(md).toContain(`## ${section}`);
    }
    const prov = readFileSync(join(GOLDEN_DIR, 'historical', 'PROVENANCE.md'), 'utf8');
    for (const field of ['ca1f5a7', 'gpt-6-astra', 'gpt-4o', '2026-09-17']) {
      expect(prov).toContain(field);
    }
    // The historical NAD safe failure is preserved, not sanitized away.
    expect(md).toContain('REJECTED,REJECTED');
    expect(existsSync(join(GOLDEN_DIR, 'historical', 'acceptance.jsonl'))).toBe(true);
  });
});

describe('Layer-1 invariant wiring — the pins this corpus relies on exist and hold their content', () => {
  const pin = (rel: string) => {
    const p = join(WEB_SRC, rel);
    expect(existsSync(p), `${rel} must exist`).toBe(true);
    return readFileSync(p, 'utf8');
  };

  it('exact figures / watt-load / evidence voice require license → deterministic-trust pins', () => {
    const src = pin('lib/reasoning/__tests__/deterministic-trust.test.ts');
    for (const key of ['wattLoad', 'strayFigures', 'evidenceVoice']) expect(src.toLowerCase()).toContain(key.toLowerCase());
  });

  it('deletion never publishes → migration1 publication pins', () => {
    const src = pin('lib/reasoning/__tests__/migration1-publication.test.ts');
    expect(src).toMatch(/rewrite:\s*null|REJECTED/);
  });

  it('safe failure never falls through to legacy → migration1 authority pins', () => {
    pin('lib/reasoning/__tests__/migration1-authority.test.ts');
  });

  it('actual roster never mutates from explicit new-system turns → isolation pins', () => {
    const src = pin('lib/__tests__/new-system-isolation.test.ts');
    expect(src).toContain('statesNewSystem');
  });

  it('founder lane uses the expected model/validator → astra config pins', () => {
    const src = pin('lib/reasoning/__tests__/m1-astra-config.test.ts');
    expect(src).toContain('gpt-6-astra');
  });

  it('contributor records never enter reasoning → Suggested Edits structural pins', () => {
    const src = pin('lib/contributions/__tests__/slice1.test.ts');
    expect(src).toContain('ABSOLUTE TRUST BOUNDARY');
    // The pin scans the reasoning and evidence layers for the module's
    // identifiers — that scan is what the corpus references instead of
    // duplicating machinery (the Tier C runner adds a runtime canary).
    expect(src).toMatch(/reasoning.+evidence|'\.\.\/\.\.\/reasoning'/s);
  });
});

describe('hypothetical slot morphology (§7) — deterministic, no model', () => {
  const accuphase = EXPERIMENT_SYSTEMS.find((s) => s.id === 'accuphase')!;
  const assemble = (question: string, hypo: { candidate: string; incumbent: string } | null) =>
    assembleGovernedContext({
      activeSystem: { components: accuphase.components, source: 'stated' },
      currentHypothetical: hypo,
      question,
      recentTurns: [],
      userObservations: [],
    });

  it('"What if I replaced X with Y?" arms the slot', async () => {
    const ctx = await assemble('What if I replaced the E-600 with a Hegel H390?', null);
    expect(ctx.currentHypothetical?.candidate).toMatch(/Hegel/i);
  });

  it('"Suppose I tried Y instead of X." arms the slot', async () => {
    const ctx = await assemble('Suppose I tried a Hegel H390 instead of the E-600.', null);
    expect(ctx.currentHypothetical?.candidate).toMatch(/Hegel/i);
  });

  it('KNOWN P3 — "If I traded X for Y" does NOT arm the slot (see findings.md; flip consciously when fixed)', async () => {
    const ctx = await assemble('If I traded the E-600 for a Hegel H390, what would change?', null);
    expect(ctx.currentHypothetical).toBeNull();
  });

  it('"Forget that change." clears an armed slot', async () => {
    const ctx = await assemble('Forget that change.', { candidate: 'Hegel H390', incumbent: 'Accuphase E-600' });
    expect(ctx.currentHypothetical).toBeNull();
  });

  it('an armed slot persists through ordinary discussion of the hypothetical', async () => {
    const ctx = await assemble('Would I hear the difference at my levels?', { candidate: 'Hegel H390', incumbent: 'Accuphase E-600' });
    expect(ctx.currentHypothetical?.candidate).toMatch(/Hegel/i);
  });
});
