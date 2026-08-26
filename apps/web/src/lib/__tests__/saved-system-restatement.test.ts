import { describe, it, expect } from 'vitest';
import { buildTurnContext } from '../turn-context';

/**
 * THE CHIP-TURN INVARIANT, at the turn-context layer.
 *
 * "Assess this system" sends the saved chain as message text; the inline
 * detector re-parses it worse than the record it came from, and inline
 * precedence displaced four resolved saved components with the bare brands
 * "Dcs, ARC". The engine then asked the listener to identify equipment it
 * held a complete record of. A restatement that adds nothing defers to the
 * saved record; a genuinely different chain still takes precedence.
 */

const SAVED = {
  id: 'sys1', name: 'Test system',
  components: [
    { brand: 'dCS', name: 'Rossini Apex', category: 'dac' },
    { brand: 'ARC', name: 'ref', category: 'preamplifier' },
    { brand: 'Butler', name: 'Monads', category: 'amplifier' },
    { brand: 'Acora', name: 'QRC-2', category: 'speaker' },
  ],
};

const stateWith = (extra: Record<string, unknown> = {}) => ({
  savedSystems: [SAVED],
  activeSystemRef: { kind: 'saved', id: 'sys1' },
  draftSystem: null,
  proposedSystem: null,
  ...extra,
} as never);

const CHIP = 'Assess my system: dCS Rossini Apex, ARC ref, Butler Monads, Acora QRC-2';

describe('the saved system survives its own restatement', () => {
  it('the chip message resolves to the SAVED system, all four components', () => {
    const ctx = buildTurnContext(CHIP, stateWith(), new Set(), null as never);
    expect(ctx.systemSource).toBe('saved');
    expect(ctx.activeSystem?.components).toHaveLength(4);
    expect(ctx.activeSystem?.components.map((c) => c.name)).toContain('QRC-2');
  });

  it('a partial restatement also defers to the saved record', () => {
    const ctx = buildTurnContext(
      'Assess my system: dCS Rossini Apex, ARC ref', stateWith(), new Set(), null as never);
    expect(ctx.systemSource).toBe('saved');
    expect(ctx.activeSystem?.components).toHaveLength(4);
  });

  it('a genuinely different inline chain still takes precedence', () => {
    const ctx = buildTurnContext(
      'Assess my system: Chord Hugo TT, Leben CS600, Klipsch Cornwall IV',
      stateWith(), new Set(), null as never);
    expect(ctx.systemSource).toBe('inline');
  });

  it('one new component among restated ones is a new chain, not a restatement', () => {
    const ctx = buildTurnContext(
      'Assess my system: dCS Rossini Apex, ARC ref, Leben CS600, Acora QRC-2',
      stateWith(), new Set(), null as never);
    expect(ctx.systemSource).toBe('inline');
  });

  it('with no saved system the inline parse works exactly as before', () => {
    const ctx = buildTurnContext(CHIP,
      stateWith({ savedSystems: [], activeSystemRef: null }), new Set(), null as never);
    expect(ctx.systemSource).toBe('inline');
  });
});
