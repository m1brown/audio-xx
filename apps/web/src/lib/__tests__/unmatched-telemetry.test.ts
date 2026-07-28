/**
 * H1 — unmatched-model demand telemetry. Pure, privacy-safe collection of the
 * events page.tsx emits so post-beta demand can be ranked. Covers the four
 * required cases: clarification, low-confidence, successful assessment (no
 * event), and duplicate-token de-dupe.
 */
import { describe, it, expect } from 'vitest';
import { collectUnmatchedModels } from '../unmatched-telemetry';
import { detectIntent, extractSubjectMatches } from '../intent';
import { buildSystemAssessment } from '../consultation';

describe('collectUnmatchedModels', () => {
  it('clarification → one event per unresolved token, reason=clarification', () => {
    const events = collectUnmatchedModels({
      kind: 'clarification',
      clarification: { unresolved: ['Cambridge AXA35', 'Wharfedale Diamond 12.1'] },
    } as never);
    expect(events).toEqual([
      { model: 'Cambridge AXA35', reason: 'clarification' },
      { model: 'Wharfedale Diamond 12.1', reason: 'clarification' },
    ]);
    // privacy: single tokens, never a full comma-joined system string
    expect(events.every((e) => !/,/.test(e.model))).toBe(true);
  });

  it('low_confidence → one event per unknown component, reason=low_confidence', () => {
    const events = collectUnmatchedModels({
      kind: 'low_confidence',
      unknownComponents: ['Fooblaster 9000', 'Sonic Deathray Mk II'],
    } as never);
    expect(events.map((e) => e.reason)).toEqual(['low_confidence', 'low_confidence']);
    expect(events.map((e) => e.model)).toEqual(['Fooblaster 9000', 'Sonic Deathray Mk II']);
  });

  it('successful assessment → no events (real engine result)', () => {
    const subs = extractSubjectMatches('Assess my system: Denafrips Pontus II, Leben CS600X, DeVore O/96');
    const { desires } = detectIntent('Assess my system: Denafrips Pontus II, Leben CS600X, DeVore O/96');
    const r: any = buildSystemAssessment('Assess my system: Denafrips Pontus II, Leben CS600X, DeVore O/96', subs, null, desires);
    expect(r.kind).toBe('assessment');
    expect(collectUnmatchedModels(r)).toEqual([]);
  });

  it('duplicate tokens within one submission are collapsed (case-insensitive, blanks dropped)', () => {
    const events = collectUnmatchedModels({
      kind: 'clarification',
      clarification: { unresolved: ['Aiyima A07', 'aiyima a07', '  Aiyima A07 ', '', undefined] },
    } as never);
    expect(events).toEqual([{ model: 'Aiyima A07', reason: 'clarification' }]);
  });

  it('null / empty inputs are safe no-ops', () => {
    expect(collectUnmatchedModels(null)).toEqual([]);
    expect(collectUnmatchedModels({ kind: 'clarification', clarification: { unresolved: [] } } as never)).toEqual([]);
    expect(collectUnmatchedModels({ kind: 'low_confidence' } as never)).toEqual([]);
  });
});
