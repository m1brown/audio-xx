/**
 * New-system isolation invariant (M1 plumbing, 2026-09-16).
 *
 * Live P1: with France II selected and its statement accumulated in the
 * assessment state machine, "Assess this system: dCS Rossini Apex, ARC
 * Ref 5, Butler Monads, Acora QRC-2" re-extracted subjects from ALL
 * accumulated text — Chord Hugo merged into the explicit new roster and
 * produced a false duplicate-DAC clarification.
 *
 * The invariant: an explicit complete system statement creates a
 * CONVERSATION-LOCAL system whose membership is exactly what the turn
 * states. The three semantic cases stay distinct:
 *   A. "Assess my system."            → selected saved system is the input.
 *   B. "Assess this system: A,B,C,D." → conversation-local roster only.
 *   C. "What if I replace X with Y?"  → hypothetical; actual unchanged.
 */
import { describe, it, expect } from 'vitest';
import { transition, INITIAL_CONV_STATE, type ConvState } from '../conversation-state';
import { buildTurnContext } from '../turn-context';
import { extractSubjectMatches } from '../intent';
import { detectSystemDescription } from '../system-extraction';

const FRANCE_II_STATEMENT = 'Assess my system: Eversolo DMP-A6, Chord Hugo, JOB INTegrated, WLM Diva Monitor.';
const NEW_SYSTEM_STATEMENT = 'Assess this system: dCS Rossini Apex, ARC Ref 5, Butler Monads, Acora QRC-2';

const SAVED_FRANCE_II = {
  id: 'france-ii', name: 'France II',
  components: [
    { brand: 'JOB', name: 'INTegrated', category: 'amplifier' },
    { brand: 'WLM', name: 'Diva Monitor', category: 'speaker' },
    { brand: 'Eversolo', name: 'DMP-A6', category: 'streamer' },
    { brand: 'Chord', name: 'Hugo', category: 'dac' },
  ],
};
const audioStateWithSaved = () => ({
  savedSystems: [structuredClone(SAVED_FRANCE_II)],
  activeSystemRef: { kind: 'saved', id: 'france-ii' },
  draftSystem: null,
  proposedSystem: null,
}) as never;

/** The state the founder's session was in: assessment ran, turns accumulated. */
const accumulatedState = (): ConvState => ({
  mode: 'system_assessment',
  stage: 'ready_to_assess',
  facts: {
    hasSystem: true,
    systemComponents: [FRANCE_II_STATEMENT],
    systemAssessmentText: FRANCE_II_STATEMENT,
  },
}) as ConvState;

describe('machine accumulation — explicit new system replaces, never merges', () => {
  it('ready_to_assess + statesNewSystem → accumulation reset to this turn only', () => {
    const r = transition(accumulatedState(), NEW_SYSTEM_STATEMENT, {
      hasSystem: true, subjectCount: 2, detectedIntent: 'system_assessment',
      statesNewSystem: true,
    });
    expect(r.state.facts.systemAssessmentText).toBe(NEW_SYSTEM_STATEMENT);
    expect(r.state.facts.systemComponents).toEqual([NEW_SYSTEM_STATEMENT]);
    // The reset text carries no France II component for re-extraction.
    const subjects = extractSubjectMatches(r.state.facts.systemAssessmentText!).map((s) => s.name.toLowerCase());
    for (const leaked of ['hugo', 'eversolo', 'wlm', 'job integrated']) {
      expect(subjects.join(' | ')).not.toContain(leaked);
    }
  });

  it('assembling_system + statesNewSystem → same replacement', () => {
    const st: ConvState = {
      mode: 'system_assessment', stage: 'assembling_system',
      facts: { systemComponents: ['old text'], systemAssessmentText: 'old text' },
    } as ConvState;
    const r = transition(st, NEW_SYSTEM_STATEMENT, {
      hasSystem: true, subjectCount: 2, detectedIntent: 'system_assessment',
      statesNewSystem: true,
    });
    expect(r.state.facts.systemAssessmentText).toBe(NEW_SYSTEM_STATEMENT);
  });

  it('without the flag, incremental clarification still accumulates (unchanged behavior)', () => {
    const r = transition(accumulatedState(), 'The speakers are on stands about two feet out.', {
      hasSystem: true, subjectCount: 0, detectedIntent: 'system_assessment',
      statesNewSystem: false,
    });
    expect(r.state.facts.systemAssessmentText).toContain(FRANCE_II_STATEMENT);
    expect(r.state.facts.systemAssessmentText).toContain('on stands');
  });
});

describe('the three semantic cases stay distinct', () => {
  it('CASE A — "Assess my system." uses the selected saved system', () => {
    const ctx = buildTurnContext('Assess my system.', audioStateWithSaved(), new Set(), undefined);
    expect(ctx.proposedSystem).toBeNull();
    expect(ctx.systemSource).toBe('saved');
    expect(ctx.activeSystem?.components.map((c) => c.name)).toContain('Hugo');
  });

  it('CASE B — explicit new system wins over the selected saved system, roster exact', () => {
    const ctx = buildTurnContext(NEW_SYSTEM_STATEMENT, audioStateWithSaved(), new Set(), undefined);
    expect(ctx.systemSource).toBe('inline');
    const names = (ctx.activeSystem?.components ?? []).map((c) => `${c.brand} ${c.name}`.toLowerCase());
    expect(names.join(' | ')).toContain('rossini');
    for (const leaked of ['hugo', 'eversolo', 'wlm', 'integrated']) {
      expect(names.join(' | '), `saved component leaked: ${leaked}`).not.toContain(leaked);
    }
    // This turn genuinely states a complete system — the page passes this
    // to the machine as statesNewSystem.
    expect((ctx.proposedSystem?.components.length ?? 0)).toBeGreaterThanOrEqual(2);
  });

  it('CASE C — a hypothetical replacement is NOT a system statement', () => {
    const t = 'What if I replace the Chord Hugo with a dCS Rossini Apex?';
    const ps = detectSystemDescription(t, extractSubjectMatches(t), audioStateWithSaved());
    // No complete-system proposal → statesNewSystem false → the machine
    // accumulates and the lane's one-slot hypothetical semantics own it.
    expect((ps?.components.length ?? 0)).toBeLessThan(2);
    const r = transition(accumulatedState(), t, {
      hasSystem: true, subjectCount: 2, detectedIntent: 'system_assessment',
      statesNewSystem: false,
    });
    expect(r.state.facts.systemAssessmentText).toContain(FRANCE_II_STATEMENT);
  });

  it('CASE D — a shared component explicitly named appears once; nothing else leaks', () => {
    const t = 'Assess this system: Chord Hugo, dCS Rossini Apex, Acora QRC-2';
    const ctx = buildTurnContext(t, audioStateWithSaved(), new Set(), undefined);
    expect(ctx.systemSource).toBe('inline');
    const names = (ctx.activeSystem?.components ?? []).map((c) => `${c.brand} ${c.name}`.toLowerCase());
    expect(names.filter((n) => n.includes('hugo'))).toHaveLength(1);
    for (const leaked of ['eversolo', 'wlm', 'integrated']) {
      expect(names.join(' | ')).not.toContain(leaked);
    }
  });
});

describe('saved-system immutability', () => {
  it('resolving an explicit new system never mutates the saved record', () => {
    const audioState = audioStateWithSaved() as { savedSystems: Array<typeof SAVED_FRANCE_II> };
    const before = JSON.stringify(audioState.savedSystems);
    buildTurnContext(NEW_SYSTEM_STATEMENT, audioState as never, new Set(), undefined);
    transition(accumulatedState(), NEW_SYSTEM_STATEMENT, {
      hasSystem: true, subjectCount: 2, detectedIntent: 'system_assessment',
      statesNewSystem: true,
    });
    expect(JSON.stringify(audioState.savedSystems)).toBe(before);
  });
});

describe('page wiring — the flag comes from the message-level parse', () => {
  it('handleSubmit passes statesNewSystem into the machine', () => {
    const { readFileSync } = require('node:fs') as typeof import('node:fs');
    const { join } = require('node:path') as typeof import('node:path');
    const SRC = readFileSync(join(__dirname, '../../app/page.tsx'), 'utf8');
    expect(SRC).toContain('statesNewSystem: !!userStatedSystemWarm,');
    // Both the main transition and the fact-backfill rerun carry it.
    expect(SRC.split('statesNewSystem: !!userStatedSystemWarm,').length - 1).toBe(2);
  });
});
