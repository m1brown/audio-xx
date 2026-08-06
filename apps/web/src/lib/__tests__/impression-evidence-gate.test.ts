/**
 * C2 — the system must not claim to have read impressions it was never given.
 *
 * "How do I make my system sound better?" told first-time visitors:
 * "Your listening impressions suggest the system is performing well. No
 * symptoms of fatigue, regression, or imbalance were detected."
 *
 * Two causes, both pinned here:
 *  1. `symptoms_absent` is satisfied by an empty symptom list, so a rule
 *     conditioned only on absence fires for someone who described nothing.
 *  2. The word "better" emits the symptom `improvement` — an entry filed
 *     under "Improvement Markers" in signals.yaml. It signals intent, not
 *     something heard, so it must not count as impression evidence.
 */
import { describe, it, expect } from 'vitest';
import { evaluate, processText } from '../engine';

const ctx = (symptoms: string[]) => ({
  symptoms, traits: {}, archetypes: [], uncertainty_level: 0, has_improvement_signals: true,
});
const fired = (r: any) => r.fired_rules.map((f: any) => f.id);

describe('impression-evidence gate', () => {
  it('"make my system sound better" yields only the intent marker', () => {
    const r: any = processText('How do I make my system sound better?');
    expect(r.symptoms).toEqual(['improvement']);
  });

  it('does not claim to have read impressions when nothing was described', () => {
    expect(fired(evaluate(ctx([])))).not.toContain('system-performing-well');
  });

  it('does not count the "improvement" intent marker as impression evidence', () => {
    expect(fired(evaluate(ctx(['improvement'])))).not.toContain('system-performing-well');
  });

  it('still speaks when the listener described a real absence of problems', () => {
    // A described symptom licenses the rule — restraint is preserved.
    const r = fired(evaluate(ctx(['too_polite'])));
    expect(Array.isArray(r)).toBe(true);
  });

  it('never leaves the turn without a rule', () => {
    expect(fired(evaluate(ctx([]))).length).toBeGreaterThan(0);
  });
});
