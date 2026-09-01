/**
 * SAVED-SYSTEM AUTHORITY INVARIANT (production blocker, 2026-09-01).
 *
 *   IF A SAVED SYSTEM IS SELECTED AND ITS CANONICAL RECORD CONTAINS
 *   ORDERED COMPONENTS/ROLES, THAT RECORD IS AUTHORITATIVE.
 *   SAVED STRUCTURED STATE > NATURAL-LANGUAGE REPARSE.
 *
 * The founder reproduced, on production, a selected saved system being
 * re-parsed from its own restatement into "Dcs, ARC", with a signal-flow
 * clarification for a chain the application held in canonical order. The
 * deployed build turned out to be months-stale foreign code (main-branch
 * auto-deploy hazard, fixed by merge), but one piece was real at HEAD:
 * the save-suggestion chip proposed a degraded duplicate for a
 * restatement of the active saved system. The repair: a restatement is
 * NOT a proposal — `turnCtx.proposedSystem` is null for it, so every
 * consumer (chip, injection guards, active-system resolution) defers to
 * the canonical record at once.
 */
import { describe, it, expect } from 'vitest';
import { buildTurnContext } from '../turn-context';
import type { AudioSessionState } from '../system-types';

const NATHAN_SAVED: AudioSessionState = {
  activeSystemRef: { kind: 'saved', id: 'sys-nathan-2' } as AudioSessionState['activeSystemRef'],
  savedSystems: [{
    id: 'sys-nathan-2', name: 'Nathan 2',
    components: [
      { brand: 'dCS', name: 'Rossini Apex', category: 'streamer_dac', role: 'dac' },
      { brand: 'ARC', name: 'ref 5', category: 'preamp', role: 'preamplifier' },
      { brand: 'Butler', name: 'Monads', category: 'power_amp', role: 'amplifier' },
      { brand: 'Acora', name: 'QRC-2', category: 'speaker', role: 'speaker' },
    ],
  }] as never,
  draftSystem: null, loading: false, proposedSystem: null,
};
const NO_SAVED: AudioSessionState = {
  activeSystemRef: { kind: 'none' } as AudioSessionState['activeSystemRef'],
  savedSystems: [], draftSystem: null, loading: false, proposedSystem: null,
};

const ctx = (msg: string, state: AudioSessionState) =>
  buildTurnContext(msg, state, new Set(), undefined);

describe('saved-system authority — the canonical record wins over reparse', () => {
  it('A · bare "Assess my system" resolves to the saved record', () => {
    const c = ctx('Assess my system', NATHAN_SAVED);
    expect(c.activeSystem?.components.length).toBe(4);
    expect(c.proposedSystem).toBeNull();
  });

  it('B · full component restatement stays with the saved record — no proposal, no downgrade', () => {
    const c = ctx('Assess my system: dCS Rossini Apex, ARC ref 5, Butler Monads, Acora QRC-2', NATHAN_SAVED);
    expect(c.proposedSystem, 'a restatement is not a proposal').toBeNull();
    expect(c.activeSystem?.components.length, 'never fewer components than the record').toBe(4);
    const names = (c.activeSystem?.components ?? []).map((x) => `${x.brand} ${x.name}`).join('|');
    expect(names).toContain('Butler Monads');
    expect(names).toContain('Acora QRC-2');
  });

  it('C · "Assess Nathan 2" resolves to the saved record', () => {
    const c = ctx('Assess Nathan 2', NATHAN_SAVED);
    expect(c.activeSystem?.components.length).toBe(4);
    expect(c.proposedSystem).toBeNull();
  });

  it('D · a genuinely different list with no saved match proposes and wins', () => {
    const c = ctx('Assess my system: PrimaLuna EVO 300 tube amp with Klipsch Cornwall IV speakers, source is a Bluesound Node', NO_SAVED);
    expect(c.proposedSystem).not.toBeNull();
    expect((c.proposedSystem?.components.length ?? 0)).toBeGreaterThanOrEqual(2);
  });

  it('D2 · a different list wins even WITH a saved system selected', () => {
    const c = ctx('Assess my system: PrimaLuna EVO 300 tube amp with Klipsch Cornwall IV speakers, source is a Bluesound Node', NATHAN_SAVED);
    const names = (c.activeSystem?.components ?? []).map((x) => `${x.brand ?? ''} ${x.name ?? ''}`).join('|');
    expect(names).toMatch(/PrimaLuna|Klipsch|Bluesound/i);
    expect(names).not.toContain('Butler');
  });

  it('I · no degraded Review-&-save duplicate for an active saved-system restatement', () => {
    // The exact production journey: the chip proposed "Dcs, ARC".
    const c = ctx('Assess my system: dCS Rossini Apex, ARC ref 5, Butler Monads, Acora QRC-2', NATHAN_SAVED);
    expect(c.proposedSystem).toBeNull();
  });

  it('partial restatement (subset of the record) is still a restatement', () => {
    const c = ctx('Assess my system: dCS Rossini Apex and the Butler Monads', NATHAN_SAVED);
    expect(c.proposedSystem).toBeNull();
    expect(c.activeSystem?.components.length).toBe(4);
  });
});
