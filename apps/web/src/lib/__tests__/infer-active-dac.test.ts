/**
 * Tests for inferActiveDAC() — active DAC inference heuristic.
 *
 * Covers:
 *   1. Single DAC only → confidence high
 *   2. Streamer/DAC + integrated amp/DAC → integrated selected, confidence medium
 *   3. Streamer/DAC + standalone DAC → standalone selected, confidence medium
 *   4. Standalone + integrated + source all present → standalone, confidence medium
 *   5. Two standalone DACs → needsDACClarification, confidence low
 *   6. Malformed/missing roles → no crash, low confidence, needsDACClarification true
 *   7. All-in-one (dac + amp + streamer) → classify as integrated, single = high
 *   8. No DAC in system → confidence low, needsDACClarification false
 *   9. Empty components array → confidence low, needsDACClarification false
 */

import { inferActiveDAC } from '../consultation';
import type { SystemComponent } from '../consultation';

// ── Helpers ────────────────────────────────────────────

function makeComponent(
  displayName: string,
  role: string,
  roles: string[],
): SystemComponent {
  return {
    displayName,
    role,
    roles,
    character: `${displayName} character`,
  };
}

// ── Test cases ─────────────────────────────────────────

describe('inferActiveDAC', () => {
  // ── 1. Single DAC only ──

  it('single standalone DAC → confidence high, no clarification needed', () => {
    const components = [
      makeComponent('Chord Qutest', 'dac', ['dac']),
      makeComponent('Pass Labs INT-25', 'amplifier', ['amplifier']),
      makeComponent('Harbeth P3ESR', 'speaker', ['speaker']),
    ];

    const result = inferActiveDAC(components);

    expect(result.activeDACName).toBe('Chord Qutest');
    expect(result.activeDACType).toBe('standalone');
    expect(result.multipleDACs).toBe(false);
    expect(result.needsDACClarification).toBe(false);
    expect(result.confidence).toBe('high');
  });

  it('single source DAC (Node only) → confidence high', () => {
    const components = [
      makeComponent('Bluesound Node', 'streamer', ['streamer', 'dac']),
      makeComponent('NAD C 316BEE', 'amplifier', ['amplifier']),
      makeComponent('ELAC Debut B6.2', 'speaker', ['speaker']),
    ];

    const result = inferActiveDAC(components);

    expect(result.activeDACName).toBe('Bluesound Node');
    expect(result.activeDACType).toBe('source');
    expect(result.multipleDACs).toBe(false);
    expect(result.needsDACClarification).toBe(false);
    expect(result.confidence).toBe('high');
  });

  // ── 2. Streamer/DAC + integrated amp/DAC ──

  it('source DAC + integrated amp DAC → integrated selected, confidence medium', () => {
    const components = [
      makeComponent('Bluesound Node', 'streamer', ['streamer', 'dac']),
      makeComponent('Naim Uniti Atom', 'amplifier', ['amplifier', 'dac']),
      makeComponent('Focal Aria 906', 'speaker', ['speaker']),
    ];

    const result = inferActiveDAC(components);

    expect(result.activeDACName).toBe('Naim Uniti Atom');
    expect(result.activeDACType).toBe('integrated');
    expect(result.multipleDACs).toBe(true);
    expect(result.needsDACClarification).toBe(false);
    expect(result.confidence).toBe('medium');
  });

  // ── 3. Streamer/DAC + standalone DAC ──

  it('source DAC + standalone DAC → standalone selected, confidence medium', () => {
    const components = [
      makeComponent('Bluesound Node', 'streamer', ['streamer', 'dac']),
      makeComponent('Chord Qutest', 'dac', ['dac']),
      makeComponent('Pass Labs INT-25', 'amplifier', ['amplifier']),
      makeComponent('Harbeth P3ESR', 'speaker', ['speaker']),
    ];

    const result = inferActiveDAC(components);

    expect(result.activeDACName).toBe('Chord Qutest');
    expect(result.activeDACType).toBe('standalone');
    expect(result.multipleDACs).toBe(true);
    expect(result.needsDACClarification).toBe(false);
    expect(result.confidence).toBe('medium');
  });

  // ── 4. All three levels present ──

  it('standalone + integrated + source → standalone selected, confidence medium', () => {
    const components = [
      makeComponent('Bluesound Node', 'streamer', ['streamer', 'dac']),
      makeComponent('Naim Uniti Atom', 'amplifier', ['amplifier', 'dac']),
      makeComponent('Chord Hugo TT2', 'dac', ['dac']),
      makeComponent('Harbeth P3ESR', 'speaker', ['speaker']),
    ];

    const result = inferActiveDAC(components);

    expect(result.activeDACName).toBe('Chord Hugo TT2');
    expect(result.activeDACType).toBe('standalone');
    expect(result.multipleDACs).toBe(true);
    expect(result.needsDACClarification).toBe(false);
    expect(result.confidence).toBe('medium');
  });

  // ── 5. Two standalone DACs → same-priority tie ──

  it('two standalone DACs → needsDACClarification true, confidence low', () => {
    const components = [
      makeComponent('Chord Qutest', 'dac', ['dac']),
      makeComponent('Denafrips Ares II', 'dac', ['dac']),
      makeComponent('Pass Labs INT-25', 'amplifier', ['amplifier']),
      makeComponent('Harbeth P3ESR', 'speaker', ['speaker']),
    ];

    const result = inferActiveDAC(components);

    expect(result.activeDACName).toBeNull();
    expect(result.activeDACType).toBeNull();
    expect(result.multipleDACs).toBe(true);
    expect(result.needsDACClarification).toBe(true);
    expect(result.confidence).toBe('low');
  });

  // ── 6. Malformed / missing roles ──

  it('missing roles[] on single DAC → low confidence, needsDACClarification true', () => {
    const components = [
      { displayName: 'Mystery DAC', role: 'dac', roles: undefined as unknown as string[], character: 'test' },
      makeComponent('Pass Labs INT-25', 'amplifier', ['amplifier']),
    ] as SystemComponent[];

    const result = inferActiveDAC(components);

    expect(result.activeDACName).toBe('Mystery DAC');
    expect(result.activeDACType).toBe('standalone');
    expect(result.multipleDACs).toBe(false);
    expect(result.confidence).toBe('low');
    // Degraded data → low confidence → needsDACClarification true
    expect(result.needsDACClarification).toBe(true);
  });

  it('empty roles[] on single DAC → low confidence, needsDACClarification true', () => {
    const components = [
      { displayName: 'Bare DAC', role: 'dac', roles: [] as string[], character: 'test' },
      makeComponent('NAD C 316BEE', 'amplifier', ['amplifier']),
    ] as SystemComponent[];

    const result = inferActiveDAC(components);

    expect(result.activeDACName).toBe('Bare DAC');
    expect(result.multipleDACs).toBe(false);
    expect(result.confidence).toBe('low');
    expect(result.needsDACClarification).toBe(true);
  });

  it('component with no role and no roles does not crash', () => {
    const components = [
      { displayName: 'Ghost', role: undefined as unknown as string, roles: undefined as unknown as string[], character: 'test' },
      makeComponent('Chord Qutest', 'dac', ['dac']),
    ] as SystemComponent[];

    const result = inferActiveDAC(components);

    // Ghost has no dac role (safeRoles → ['component']) — only Qutest is DAC-capable
    expect(result.activeDACName).toBe('Chord Qutest');
    expect(result.needsDACClarification).toBe(false);
    expect(result.confidence).toBe('high');
  });

  it('multiple DACs with one having degraded roles → low confidence, needsDACClarification true', () => {
    // Streamer with missing roles[] AND role 'dac' → safeRoles returns ['dac'] → detected as DAC
    const components = [
      { displayName: 'Degraded Source', role: 'dac', roles: undefined as unknown as string[], character: 'test' },
      makeComponent('Chord Qutest', 'dac', ['dac']),
    ] as SystemComponent[];

    const result = inferActiveDAC(components);

    // Two standalone DACs at same priority — but one is degraded
    // Same-priority tie → low confidence
    expect(result.multipleDACs).toBe(true);
    expect(result.confidence).toBe('low');
    expect(result.needsDACClarification).toBe(true);
  });

  // ── 7. All-in-one (dac + amp + streamer) ──

  it('all-in-one (dac + amp + streamer) classifies as integrated, confidence high', () => {
    const components = [
      makeComponent('Naim Uniti Star', 'integrated', ['dac', 'amplifier', 'streamer']),
      makeComponent('Focal Kanta No.2', 'speaker', ['speaker']),
    ];

    const result = inferActiveDAC(components);

    expect(result.activeDACName).toBe('Naim Uniti Star');
    expect(result.activeDACType).toBe('integrated');
    expect(result.multipleDACs).toBe(false);
    expect(result.needsDACClarification).toBe(false);
    expect(result.confidence).toBe('high');
  });

  it('all-in-one + standalone DAC → standalone wins, confidence medium', () => {
    const components = [
      makeComponent('Naim Uniti Star', 'integrated', ['dac', 'amplifier', 'streamer']),
      makeComponent('Chord Hugo TT2', 'dac', ['dac']),
      makeComponent('Focal Kanta No.2', 'speaker', ['speaker']),
    ];

    const result = inferActiveDAC(components);

    expect(result.activeDACName).toBe('Chord Hugo TT2');
    expect(result.activeDACType).toBe('standalone');
    expect(result.multipleDACs).toBe(true);
    expect(result.needsDACClarification).toBe(false);
    expect(result.confidence).toBe('medium');
  });

  // ── 8. No DAC in system ──

  it('no DAC-capable component → null, confidence low, needsDACClarification false', () => {
    const components = [
      makeComponent('Rega Planar 3', 'turntable', ['turntable']),
      makeComponent('Pass Labs INT-25', 'amplifier', ['amplifier']),
      makeComponent('Harbeth P3ESR', 'speaker', ['speaker']),
    ];

    const result = inferActiveDAC(components);

    expect(result.activeDACName).toBeNull();
    expect(result.activeDACType).toBeNull();
    expect(result.multipleDACs).toBe(false);
    // Not ambiguity — just no DAC present
    expect(result.needsDACClarification).toBe(false);
    expect(result.confidence).toBe('low');
  });

  // ── 9. Empty / edge cases ──

  it('empty components array → confidence low, needsDACClarification false', () => {
    const result = inferActiveDAC([]);

    expect(result.activeDACName).toBeNull();
    expect(result.multipleDACs).toBe(false);
    // Incomplete input, not DAC-path ambiguity
    expect(result.needsDACClarification).toBe(false);
    expect(result.confidence).toBe('low');
  });
});
