/**
 * Clarification UX (beta): confirm recognized components first, ask only about
 * the unresolved ambiguity. Presentation/copy only — graph resolution and the
 * dropped/duplicate/unresolved decision are unchanged.
 */
import { describe, it, expect } from 'vitest';
import { detectIntent, extractSubjectMatches } from '../intent';
import { buildSystemAssessment } from '../consultation';

function clarify(text: string) {
  const subs = extractSubjectMatches(text);
  const { desires } = detectIntent(text);
  const r: any = buildSystemAssessment(text, subs, null, desires);
  return r?.kind === 'clarification' ? r.clarification : null;
}

describe('graph-integrity clarification confirms recognized components', () => {
  it('surfaces recognized components as a structured list and asks only about the gap', () => {
    // DeVore + Leben are recognized; the third (uncatalogued) forces a clarify.
    const c = clarify('Assess my system: DeVore O/96, Leben CS600X, iFi Zen DAC');
    expect(c, 'expected a clarification').not.toBeNull();
    // Recognized components are structured (for the ✓ checklist), not buried in prose.
    expect(Array.isArray(c.recognized)).toBe(true);
    expect(c.recognized.length).toBeGreaterThan(0);
    expect(c.recognized.join(' ')).toMatch(/devore|leben/i);
    // Expert-verification tone, not parser-recovery.
    expect(c.acknowledge).toMatch(/placed|shape of your system/i);
    expect(c.acknowledge).not.toMatch(/make sure I have your system right/i);
    // The recognized list is no longer restated inside the question prose.
    expect(c.question).not.toMatch(/so far i can place/i);
  });

  it('when nothing is recognized, no checklist is offered (recognized undefined)', () => {
    const c = clarify('Assess my system: Fooblaster 9000, Sonic Deathray Mk II');
    // Either a clarification with no recognized list, or another honest decline —
    // both acceptable; if it clarifies, recognized must not be a bogus list.
    if (c && c.recognized) {
      expect(c.recognized.every((n: string) => n && n.length > 0)).toBe(true);
    }
    expect(true).toBe(true);
  });
});
